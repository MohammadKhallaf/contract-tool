/**
 * Shared utilities for schema parsing, enum normalization, and JSON Schema conversion.
 * Used by type-generator, schema-generator, swagger-generator, openapi-generator, and markdown-generator.
 */

const PRIMITIVES = new Set([
  "string", "number", "boolean", "null", "undefined", "unknown", "any",
  "integer", "int", "float", "double", "bool", "text",
]);

// ---------------------------------------------------------------------------
// Enum helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if every pipe-separated part looks like an enum value
 * (i.e. none are primitives). Does NOT reject multi-word values.
 */
export function isUnquotedEnum(parts: string[]): boolean {
  return (
    parts.length > 1 &&
    parts.every((p) => p.length > 0 && !PRIMITIVES.has(p.toLowerCase()))
  );
}

/**
 * Normalize an unquoted pipe-separated enum string like "active | inactive | in progress"
 * into a valid TypeScript union type: "active" | "inactive" | "in progress".
 * Leaves already-quoted unions and plain types untouched.
 */
export function normalizeEnumType(raw: string): string {
  const trimmed = raw.trim();
  // Already has quotes → already a TS union
  if (/["']/.test(trimmed)) return trimmed;
  // Must contain "|"
  if (!trimmed.includes("|")) return trimmed;
  const parts = trimmed.split("|").map((s) => s.trim());
  if (!isUnquotedEnum(parts)) return trimmed;
  // All segments look like enum values — quote them
  return parts.map((p) => `"${p}"`).join(" | ");
}

// ---------------------------------------------------------------------------
// Depth-aware data item shape extractor
// ---------------------------------------------------------------------------

export interface DataItemShape {
  /** The raw item shape string (either `{ ... }` or a type name) */
  itemShape: string;
  /** If the item is a named type (e.g. `Campaign`), the name */
  namedType?: string;
  /** True when the item shape is an inline `{ ... }` object literal */
  isInline: boolean;
}

/**
 * Depth-counting brace extractor. Finds `data:` key in a schema string,
 * then counts `{`/`}` depth to extract the full `{ ... }` even with nested braces.
 * Returns null if no `data: ...[]` pattern is found.
 */
export function extractDataItemShape(rawSchema: string): DataItemShape | null {
  if (!rawSchema) return null;

  // Find `data:` or `"data":` or `'data':` position
  const dataMatch = rawSchema.match(/["']?data["']?\s*:\s*/);
  if (!dataMatch || dataMatch.index === undefined) return null;

  const afterData = rawSchema.slice(dataMatch.index + dataMatch[0].length);

  // Case 1: inline object — starts with `{`
  if (afterData.trimStart().startsWith("{")) {
    const start = afterData.indexOf("{");
    let depth = 0;
    let end = -1;
    for (let i = start; i < afterData.length; i++) {
      if (afterData[i] === "{") depth++;
      else if (afterData[i] === "}") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) return null;
    const itemShape = afterData.slice(start, end + 1);
    // Verify it's followed by `[]`
    const afterBrace = afterData.slice(end + 1).trimStart();
    if (!afterBrace.startsWith("[]")) return null;
    return { itemShape, isInline: true };
  }

  // Case 2: named type — e.g. `Campaign[]`
  const namedMatch = afterData.match(/^(\w+)\[\]/);
  if (namedMatch) {
    return { itemShape: namedMatch[1], namedType: namedMatch[1], isInline: false };
  }

  return null;
}

// ---------------------------------------------------------------------------
// TS object literal parser (depth-aware field splitter)
// ---------------------------------------------------------------------------

export function parseTsObjectLiteral(schema: string): { name: string; type: string; required: boolean }[] {
  const fields: { name: string; type: string; required: boolean }[] = [];
  const inner = schema.trim().replace(/^\{|\}$/g, "").trim();
  if (!inner) return fields;
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of inner) {
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    else if ((ch === "," || ch === ";") && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  for (const part of parts) {
    const m = part.match(/^["']?(\w+)["']?(\?)?\s*:\s*([\s\S]+)$/);
    if (m) fields.push({ name: m[1], type: m[3].trim(), required: !m[2] });
  }
  return fields;
}

// ---------------------------------------------------------------------------
// TS type → JSON Schema converter (parameterized nullable key)
// ---------------------------------------------------------------------------

export interface JsonSchemaOpts {
  /** "x-nullable" for Swagger 2, "nullable" for OpenAPI 3 (default) */
  nullableKey?: string;
}

export function tsTypeToJsonSchema(tsType: string, opts: JsonSchemaOpts = {}): Record<string, unknown> {
  const nullableKey = opts.nullableKey ?? "nullable";

  // Strip inline comments like /* ISO 8601 */ and preserve as description
  const commentMatch = tsType.match(/\/\*\s*(.+?)\s*\*\//);
  const inlineComment = commentMatch?.[1];
  const trimmed = tsType.replace(/\/\*.*?\*\//g, "").trim();

  // Nested object literal: { street: string, city: string }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const fields = parseTsObjectLiteral(trimmed);
    if (fields.length > 0) {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const f of fields) {
        properties[f.name] = tsTypeToJsonSchema(f.type, opts);
        if (f.required) required.push(f.name);
      }
      const schema: Record<string, unknown> = { type: "object", properties };
      if (required.length > 0) schema.required = required;
      return schema;
    }
  }

  // Nullable: "string | null" → { type: "string", [nullableKey]: true }
  if (trimmed.includes("| null") || trimmed.includes("null |")) {
    const base = trimmed.replace(/\s*\|\s*null/g, "").replace(/null\s*\|\s*/g, "").trim();
    return { ...tsTypeToJsonSchema(base, opts), [nullableKey]: true };
  }

  // Quoted string enum union: "active" | "inactive"
  if (/^["']/.test(trimmed) || trimmed.includes('" | "') || trimmed.includes("' | '")) {
    const values = trimmed.match(/"([^"]+)"|'([^']+)'/g);
    if (values && values.length > 0) {
      return { type: "string", enum: values.map((v) => v.replace(/^["']|["']$/g, "")) };
    }
  }

  // Unquoted pipe-separated enum: active | inactive | in progress
  if (trimmed.includes("|")) {
    const parts = trimmed.split("|").map((s) => s.trim());
    if (isUnquotedEnum(parts)) {
      return { type: "string", enum: parts };
    }
  }

  const t = trimmed.toLowerCase();
  const desc = inlineComment ? { description: inlineComment } : {};
  if (t === "string") return { type: "string", ...desc };
  if (t === "number" || t === "integer" || t === "int") return { type: "integer", ...desc };
  if (t === "float" || t === "double") return { type: "number", ...desc };
  if (t === "boolean" || t === "bool") return { type: "boolean" };
  if (t === "unknown" || t === "any") return {};

  // Array with inline object items: { id: string }[]
  if (trimmed.endsWith("[]")) {
    const inner = trimmed.slice(0, -2).trim();
    return { type: "array", items: tsTypeToJsonSchema(inner, opts) };
  }

  return { type: "string", description: inlineComment ?? trimmed };
}

// ---------------------------------------------------------------------------
// Schema string → JSON Schema (wraps parseTsObjectLiteral + tsTypeToJsonSchema)
// ---------------------------------------------------------------------------

export function schemaStringToJsonSchema(schema: string, opts: JsonSchemaOpts = {}): Record<string, unknown> {
  if (!schema || !schema.trim()) return { type: "object" };
  // Try JSON parse first
  try {
    const parsed = JSON.parse(schema);
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
  } catch { /* fall through */ }
  // Try TS object literal
  const fields = parseTsObjectLiteral(schema);
  if (fields.length > 0) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const f of fields) {
      properties[f.name] = tsTypeToJsonSchema(f.type, opts);
      if (f.required) required.push(f.name);
    }
    const result: Record<string, unknown> = { type: "object", properties };
    if (required.length > 0) result.required = required;
    return result;
  }
  return { type: "object", description: schema.slice(0, 120) };
}

// ---------------------------------------------------------------------------
// Derive item type name from endpoint path + method
// ---------------------------------------------------------------------------

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Derive a type name for paginated item shapes.
 * E.g. `GET /api/campaigns` → `GetCampaignsResponseItem`
 */
export function deriveItemTypeName(path: string, method: string): string {
  const methodMap: Record<string, string> = {
    GET: "Get", POST: "Create", PUT: "Update", PATCH: "Patch", DELETE: "Delete",
  };
  const prefix = methodMap[method.toUpperCase()] ?? toPascalCase(method);
  const segments = path
    .split("/")
    .filter(Boolean)
    .filter((s) => !s.startsWith("{"))
    .map(toPascalCase);
  return `${prefix}${segments.join("")}ResponseItem`;
}

import type { Endpoint, GeneratedType } from "@/types";
import { normalizeEnumType, extractDataItemShape } from "./schema-utils";

// Returns null when schema is a bare type name (not a `{ ... }` object literal).
// Caller is responsible for resolving bare names via notes or producing a type alias.
function parseSchemaToFields(schema: string): string[] | null {
  const trimmed = schema.trim();
  if (!trimmed.startsWith("{")) return null; // bare type name — caller handles

  // Depth-counting split — only split at depth 0
  const inner = trimmed.slice(1, trimmed.lastIndexOf("}")).trim();
  if (!inner) return [`  body?: unknown; // ${trimmed.slice(0, 80)}`];

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

  const fields: string[] = [];
  for (const part of parts) {
    const m = part.match(/^["']?(\w+)["']?(\?)?\s*:\s*([\s\S]+)$/);
    if (!m) continue;
    const [, name, optional, rawType] = m;
    const type = normalizeEnumType(rawType.trim().replace(/,$/, ""));
    const isNullable = type.includes("| null") || type.includes("null |");
    // Only mark optional if schema string says so with `?`; required by default
    const opt = (isNullable || optional) ? "?" : "";
    fields.push(`  ${name}${opt}: ${type};`);
  }
  return fields.length > 0 ? fields : null;
}

// Parse notes like "CampaignResponse includes: id, name, eventName" or
// "CampaignResponse includes: id (string), name (string), status ('active'|'inactive')" or
// "CampaignResponse includes: id (string), status (string: active | completed | in_progress)"
function parseNotesForType(typeName: string, notes: string): string[] {
  if (!notes) return [];
  const pattern = new RegExp(`${typeName}\\s+includes?\\s*:([^.\\n]+)`, "i");
  const m = notes.match(pattern);
  if (!m) return [];

  // Depth-aware split on commas outside parentheses
  const tokens: string[] = [];
  let cur = "", depth = 0;
  for (const ch of m[1].trim()) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) { if (cur.trim()) tokens.push(cur.trim()); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());

  return tokens.filter(Boolean).map((token) => {
    // "fieldName (type: enum values)" — e.g. status (string: active | completed | in_progress)
    const withTypeAndDesc = token.match(/^(\w+)\s+\(([^:)]+):\s*(.+)\)$/);
    // "fieldName (type)" — e.g. name (string) or status ('active'|'inactive')
    const withType = token.match(/^(\w+)\s+\(([^)]+)\)$/);

    if (withTypeAndDesc) {
      const [, name, , enumValues] = withTypeAndDesc;
      // enumValues is "active | completed | in_progress" — normalize to quoted union
      const normalized = normalizeEnumType(enumValues.trim());
      const tsType = normalized.includes("|") ? normalized : mapSimpleType(normalized);
      return `  ${name}: ${tsType};`;
    } else if (withType) {
      const [, name, rawType] = withType;
      const normalized = normalizeEnumType(rawType.trim());
      const tsType = normalized.includes("|") ? normalized : mapSimpleType(normalized);
      return `  ${name}: ${tsType};`;
    }
    return `  ${token}: ${inferTypeFromName(token)};`;
  });
}

function mapSimpleType(t: string): string {
  const lower = t.toLowerCase();
  if (lower === "number" || lower === "integer" || lower === "int") return "number";
  if (lower === "boolean" || lower === "bool") return "boolean";
  if (lower === "string" || lower === "text") return "string";
  return t;
}

function inferTypeFromName(name: string): string {
  if (/[Dd]ate$|[Aa]t$/.test(name)) return "string";
  if (/[Ii]d$/.test(name)) return "string";
  if (/[Cc]ount$|[Tt]otal$|[Ss]core$|[Ll]eads$|[Mm]eetings$|[Pp]ipeline$/.test(name)) return "number";
  if (/[Ss]tatus$|[Tt]ype$|[Nn]ame$|[Ll]ocation$/.test(name)) return "string";
  return "unknown";
}

function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
}

function methodPrefix(method: string): string {
  const map: Record<string, string> = {
    GET: "Get",
    POST: "Create",
    PUT: "Update",
    PATCH: "Patch",
    DELETE: "Delete",
  };
  return map[method.toUpperCase()] ?? toPascalCase(method);
}

// Returns a unique resource name for (path, method) that doesn't collide with usedPrefixes.
// Tries progressively longer trailing path segments until unique.
function pathToResource(path: string, method: string, usedPrefixes: Set<string>): string {
  const segments = path
    .split("/")
    .filter(Boolean)
    .filter((s) => !s.startsWith("{"))
    .map(toPascalCase);

  for (let take = 1; take <= segments.length; take++) {
    const resource = segments.slice(-take).join("");
    const prefix = `${methodPrefix(method)}${resource}`;
    if (!usedPrefixes.has(prefix)) {
      usedPrefixes.add(prefix);
      return resource;
    }
  }
  // All combinations exhausted — use full path (should never happen in practice)
  return segments.join("");
}

export function generateTypes(
  endpoints: Endpoint[],
  existing: GeneratedType[]
): GeneratedType[] {
  const result: GeneratedType[] = [];
  const usedPrefixes = new Set<string>();

  for (const ep of endpoints) {
    if (!ep.enabled) continue;

    const resource = pathToResource(ep.path, ep.method, usedPrefixes);
    const prefix = `${methodPrefix(ep.method)}${resource}`;

    // Request type
    const requestName = `${prefix}Request`;
    const existingReq = existing.find((t) => t.name === requestName);
    if (!existingReq || !existingReq.isEdited) {
      const fields: string[] = [];

      // Path params
      ep.pathParams.forEach((p) => {
        if (p.description) fields.push(`  /** ${p.description} */`);
        const paramType = normalizeEnumType(p.type || "string");
        const isNullable = paramType.includes("| null") || paramType.includes("null |");
        fields.push(`  ${p.name}${p.required && !isNullable ? "" : "?"}: ${paramType};`);
      });

      // Query params
      ep.queryParams.forEach((p) => {
        if (p.description) fields.push(`  /** ${p.description} */`);
        const paramType = normalizeEnumType(p.type || "string");
        const isNullable = paramType.includes("| null") || paramType.includes("null |");
        fields.push(`  ${p.name}${p.required && !isNullable ? "" : "?"}: ${paramType};`);
      });

      // Request body fields — parse schema into typed fields
      if (ep.requestBody?.schema) {
        const parsed = parseSchemaToFields(ep.requestBody.schema);
        if (parsed !== null) {
          fields.push(...parsed);
        } else {
          // Bare type name — try notes for field definitions
          const bareTypeName = ep.requestBody.schema.trim();
          const fromNotes = ep.notes ? parseNotesForType(bareTypeName, ep.notes) : [];
          if (fromNotes.length > 0) {
            fields.push(...fromNotes);
          } else {
            fields.push(`  body: ${bareTypeName};`);
          }
        }
      }

      if (fields.length === 0) fields.push("  // No parameters");

      const code = `export interface ${requestName} {\n${fields.join("\n")}\n}`;
      result.push({
        id: existingReq?.id ?? crypto.randomUUID(),
        name: requestName,
        code,
        linkedEndpointIds: [ep.id],
        isEdited: false,
      });
    } else {
      result.push(existingReq);
    }

    // Response type
    const responseName = `${prefix}Response`;
    const existingResp = existing.find((t) => t.name === responseName);
    if (!existingResp || !existingResp.isEdited) {
      const schema = ep.responseBody?.schema ?? "";
      const paginated = ep.responseBody?.isPaginated;

      let code: string;
      if (paginated) {
        const dataShape = schema ? extractDataItemShape(schema) : null;

        if (dataShape?.isInline) {
          // Inline object array — data: { id: string, status: active | inactive }[]
          const itemFields = parseSchemaToFields(dataShape.itemShape) ?? ["  id: string;"];
          const itemTypeName = `${responseName}Item`;
          result.push({
            id: crypto.randomUUID(),
            name: itemTypeName,
            code: `export interface ${itemTypeName} {\n${itemFields.join("\n")}\n}`,
            linkedEndpointIds: [ep.id],
            isEdited: false,
          });
          code = `export type ${responseName} = PaginatedResponse<${itemTypeName}>;`;
        } else if (dataShape && !dataShape.isInline) {
          // Named type array — data: Campaign[]
          const itemTypeName = dataShape.namedType!;
          code = `export type ${responseName} = PaginatedResponse<${itemTypeName}>;`;
          // Auto-generate stub for itemTypeName if not already defined
          const isPrimitive = ["string", "number", "boolean", "unknown", "any", "object"].includes(itemTypeName.toLowerCase());
          if (!isPrimitive && !existing.some((t) => t.name === itemTypeName) && !result.some((t) => t.name === itemTypeName)) {
            result.push({
              id: crypto.randomUUID(),
              name: itemTypeName,
              code: `export interface ${itemTypeName} {\n  // TODO: define fields for ${itemTypeName}\n}`,
              linkedEndpointIds: [ep.id],
              isEdited: false,
            });
          }
        } else {
          // Schema is the item shape directly (no envelope detected)
          const itemFields = (schema ? parseSchemaToFields(schema) : null) ?? ["  id: string;"];
          code = `export interface ${responseName}Item {\n${itemFields.join("\n")}\n}\n\nexport type ${responseName} = PaginatedResponse<${responseName}Item>;`;

          // Auto-generate stubs for any referenced named array types
          for (const field of itemFields) {
            const refMatch = field.match(/:\s*(\w+)\[\]/);
            if (!refMatch) continue;
            const refTypeName = refMatch[1];
            const isPrimitive = ["string", "number", "boolean", "unknown", "any", "object"].includes(refTypeName.toLowerCase());
            if (isPrimitive) continue;
            if (existing.find((t) => t.name === refTypeName)) continue;
            if (result.find((t) => t.name === refTypeName)) continue;
            result.push({
              id: crypto.randomUUID(),
              name: refTypeName,
              code: `export interface ${refTypeName} {\n  // TODO: define fields for ${refTypeName}\n}`,
              linkedEndpointIds: [ep.id],
              isEdited: false,
            });
          }
        }
      } else if (schema) {
        const respFields = parseSchemaToFields(schema);
        if (respFields !== null) {
          code = `export interface ${responseName} {\n${respFields.join("\n")}\n}`;
        } else {
          // Bare type name — try notes, fall back to type alias
          const fromNotes = ep.notes ? parseNotesForType(schema.trim(), ep.notes) : [];
          if (fromNotes.length > 0) {
            code = `export interface ${responseName} {\n${fromNotes.join("\n")}\n}`;
          } else {
            code = `export type ${responseName} = ${schema.trim()};`;
          }
        }
      } else {
        code = `export interface ${responseName} {\n  // TODO: define response shape\n}`;
      }

      result.push({
        id: existingResp?.id ?? crypto.randomUUID(),
        name: responseName,
        code,
        linkedEndpointIds: [ep.id],
        isEdited: false,
      });
    } else {
      result.push(existingResp);
    }
  }

  // Add paginated helper if needed
  const hasPaginated = endpoints.some((ep) => ep.responseBody?.isPaginated);
  if (hasPaginated) {
    const helperName = "PaginatedResponse";
    const existingHelper = existing.find((t) => t.name === helperName);
    if (!existingHelper) {
      result.unshift({
        id: crypto.randomUUID(),
        name: helperName,
        code: `export interface PaginatedResponse<T> {\n  data: T[];\n  total: number;\n  offset: number;\n  itemsPerPage: number;\n}`,
        linkedEndpointIds: [],
        isEdited: false,
      });
    } else {
      result.unshift(existingHelper);
    }
  }

  // Deduplicate: keep first occurrence by name AND by id
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  return result.filter((t) => {
    if (seenNames.has(t.name) || seenIds.has(t.id)) return false;
    seenNames.add(t.name);
    seenIds.add(t.id);
    return true;
  });
}

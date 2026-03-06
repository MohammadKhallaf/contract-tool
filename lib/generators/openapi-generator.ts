import type { Contract, Endpoint, Annotation, Screen, GeneratedType } from "@/types";
import { getLinkedScreenNames } from "@/lib/utils/screen-links";

function methodToOpenApi(ep: Endpoint, annotations: Annotation[], screens: Screen[]): Record<string, unknown> {
  const operation: Record<string, unknown> = {
    summary: ep.description,
    operationId: `${ep.method.toLowerCase()}_${ep.path.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")}`,
    parameters: [] as unknown[],
    responses: {},
  };

  const parameters = operation.parameters as unknown[];

  ep.pathParams.forEach((p) => {
    parameters.push({
      name: p.name,
      in: "path",
      required: true,
      description: p.description,
      schema: { type: mapType(p.type) },
    });
  });

  ep.queryParams.forEach((p) => {
    parameters.push({
      name: p.name,
      in: "query",
      required: p.required,
      description: p.description,
      schema: { type: mapType(p.type) },
    });
  });

  ep.headers.forEach((h) => {
    parameters.push({
      name: h.name,
      in: "header",
      required: h.required,
      schema: { type: "string" },
    });
  });

  if (parameters.length === 0) delete operation.parameters;

  if (ep.requestBody) {
    const schemaObj = schemaStringToJsonSchema(ep.requestBody.schema);
    operation.requestBody = {
      required: true,
      content: {
        [ep.requestBody.contentType]: { schema: schemaObj },
      },
    };
  }

  const statusCode = ep.responseBody?.statusCode ?? 200;
  let responseSchema: unknown = { type: "object" };
  if (ep.responseBody) {
    responseSchema = schemaStringToJsonSchema(ep.responseBody.schema);
    if (ep.responseBody.isPaginated) {
      responseSchema = {
        type: "object",
        required: ["data", "total", "offset", "itemsPerPage"],
        properties: {
          data: { type: "array", items: responseSchema },
          total: { type: "integer" },
          offset: { type: "integer" },
          itemsPerPage: { type: "integer" },
        },
      };
    }
  }

  (operation.responses as Record<string, unknown>)[String(statusCode)] = {
    description: ep.description,
    content: { "application/json": { schema: responseSchema } },
  };

  if (ep.notes) operation.description = ep.notes;

  const pageNames = getLinkedScreenNames(ep, annotations, screens);
  if (pageNames.length > 0) {
    operation["x-used-on"] = pageNames;
  }

  return operation;
}

function parseInterfaceFields(code: string): { name: string; type: string; required: boolean }[] {
  const fields: { name: string; type: string; required: boolean }[] = [];
  for (const line of code.split("\n")) {
    // Skip comment lines
    if (line.trim().startsWith("//")) continue;
    const m = line.match(/^\s+(\w+)(\?)?\s*:\s*(.+?);?\s*$/);
    if (m) {
      fields.push({ name: m[1], type: m[3].trim(), required: !m[2] });
    }
  }
  return fields;
}

/** Parse a TypeScript/JS object literal like "{ id: string, name?: string }" into JSON schema fields */
function parseTsObjectLiteral(schema: string): { name: string; type: string; required: boolean }[] {
  const fields: { name: string; type: string; required: boolean }[] = [];
  // Strip outer braces and split by comma (simple, non-nested)
  const inner = schema.trim().replace(/^\{|\}$/g, "").trim();
  if (!inner) return fields;
  // Split on commas not inside brackets
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of inner) {
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    else if (ch === "," && depth === 0) { parts.push(current); current = ""; continue; }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  for (const part of parts) {
    const m = part.trim().match(/^(\w+)(\?)?\s*:\s*(.+)$/);
    if (m) fields.push({ name: m[1], type: m[3].trim(), required: !m[2] });
  }
  return fields;
}

/** Convert a schema string (TS object literal OR JSON) into a JSON Schema object */
function schemaStringToJsonSchema(schema: string): Record<string, unknown> {
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
      properties[f.name] = tsTypeToJsonSchema(f.type);
      if (f.required) required.push(f.name);
    }
    const result: Record<string, unknown> = { type: "object", properties };
    if (required.length > 0) result.required = required;
    return result;
  }
  // Fallback — treat as description
  return { type: "object", description: schema.slice(0, 120) };
}

function tsTypeToJsonSchema(tsType: string): Record<string, unknown> {
  const trimmed = tsType.trim();

  // Nullable: "string | null" → { type: "string", nullable: true }
  if (trimmed.includes("| null") || trimmed.includes("null |")) {
    const base = trimmed.replace(/\s*\|\s*null/g, "").replace(/null\s*\|\s*/g, "").trim();
    return { ...tsTypeToJsonSchema(base), nullable: true };
  }

  // String enum union: "active" | "inactive" → { type: "string", enum: [...] }
  if (/^["']/.test(trimmed) || trimmed.includes('" | "') || trimmed.includes("' | '")) {
    const values = trimmed.match(/"([^"]+)"|'([^']+)'/g);
    if (values && values.length > 0) {
      return { type: "string", enum: values.map((v) => v.replace(/^["']|["']$/g, "")) };
    }
  }

  const t = trimmed.toLowerCase();
  if (t === "string") return { type: "string" };
  if (t === "number" || t === "integer" || t === "int") return { type: "integer" };
  if (t === "float" || t === "double") return { type: "number" };
  if (t === "boolean" || t === "bool") return { type: "boolean" };
  if (t === "unknown" || t === "any") return {};
  if (t.endsWith("[]")) return { type: "array", items: tsTypeToJsonSchema(trimmed.slice(0, -2)) };
  return { type: "string", description: trimmed };
}

function typeToJsonSchema(type: GeneratedType): Record<string, unknown> {
  const fields = parseInterfaceFields(type.code);
  if (fields.length > 0) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const f of fields) {
      properties[f.name] = tsTypeToJsonSchema(f.type);
      if (f.required) required.push(f.name);
    }
    const schema: Record<string, unknown> = { type: "object", properties };
    if (required.length > 0) schema.required = required;
    return schema;
  }
  // Try extracting schema hint from comments like "// Schema hint: { id: string }"
  const hintMatch = type.code.match(/\/\/\s*(?:Schema hint|Define schema):\s*(.+)/);
  if (hintMatch) {
    return schemaStringToJsonSchema(hintMatch[1].trim());
  }
  return { type: "object", description: type.name };
}

function mapType(t: string): string {
  const lower = t.toLowerCase();
  if (lower === "number" || lower === "integer" || lower === "int") return "integer";
  if (lower === "float" || lower === "double") return "number";
  if (lower === "boolean" || lower === "bool") return "boolean";
  return "string";
}

export function generateOpenApi(contract: Contract, serverUrl = "/"): Record<string, unknown> {
  const enabledEndpoints = contract.endpoints.filter((ep) => ep.enabled);

  const paths: Record<string, Record<string, unknown>> = {};

  for (const ep of enabledEndpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};
    paths[ep.path][ep.method.toLowerCase()] = methodToOpenApi(ep, contract.annotations, contract.screens);
  }

  const spec: Record<string, unknown> = {
    openapi: "3.0.3",
    info: {
      title: contract.name,
      version: "1.0.0",
      description: contract.jiraStories.length > 0
        ? contract.jiraStories.map((s) => `${s.key ? s.key + ": " : ""}${s.title}`).join(" | ")
        : contract.name,
    },
    servers: [{ url: serverUrl, description: "Current server" }],
    paths,
  };

  const definableTypes = contract.generatedTypes.filter(
    (t) => t.name !== "PaginatedResponse"
  );
  if (definableTypes.length > 0) {
    const schemas: Record<string, unknown> = {};
    for (const t of definableTypes) {
      schemas[t.name] = typeToJsonSchema(t);
    }
    spec.components = { schemas };
  }

  return spec;
}

export function generateOpenApiYaml(contract: Contract): string {
  const spec = generateOpenApi(contract);
  return objectToYaml(spec, 0);
}

function objectToYaml(obj: unknown, indent: number): string {
  const pad = " ".repeat(indent);
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean") return obj ? "true" : "false";
  if (typeof obj === "number") return String(obj);
  if (typeof obj === "string") {
    if (obj === "") return '""';
    if (
      obj.includes("\n") ||
      obj.includes(":") ||
      obj.includes("#") ||
      obj.includes("'") ||
      obj.startsWith(" ") ||
      obj.startsWith("-")
    ) {
      return `"${obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    const lines: string[] = [];
    for (const item of obj) {
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        const entries = Object.entries(item as Record<string, unknown>);
        if (entries.length === 0) {
          lines.push(`${pad}-`);
        } else {
          const [firstKey, firstVal] = entries[0];
          const firstRendered = objectToYaml(firstVal, indent + 2);
          const firstIsBlock = typeof firstVal === "object" && firstVal !== null;
          lines.push(
            `${pad}- ${firstKey}:${firstIsBlock ? "\n" + firstRendered : " " + firstRendered}`
          );
          for (const [k, v] of entries.slice(1)) {
            const rendered = objectToYaml(v, indent + 2);
            const isBlock = typeof v === "object" && v !== null;
            lines.push(`${pad}  ${k}:${isBlock ? "\n" + rendered : " " + rendered}`);
          }
        }
      } else {
        lines.push(`${pad}- ${objectToYaml(item, indent + 2)}`);
      }
    }
    return lines.join("\n");
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>).filter(
      ([, v]) => v !== undefined
    );
    if (entries.length === 0) return "{}";
    const lines: string[] = [];
    for (const [k, v] of entries) {
      if (typeof v === "object" && v !== null) {
        if (Array.isArray(v) && v.length === 0) {
          lines.push(`${pad}${k}: []`);
        } else if (!Array.isArray(v) && Object.keys(v).length === 0) {
          lines.push(`${pad}${k}: {}`);
        } else {
          lines.push(`${pad}${k}:`);
          lines.push(objectToYaml(v, indent + 2));
        }
      } else {
        lines.push(`${pad}${k}: ${objectToYaml(v, indent)}`);
      }
    }
    return lines.join("\n");
  }
  return String(obj);
}

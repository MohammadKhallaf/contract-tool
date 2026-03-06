import type { Contract, Endpoint, GeneratedType } from "@/types";

function mapType(t: string): string {
  const lower = t.toLowerCase();
  if (lower === "integer" || lower === "int") return "integer";
  if (lower === "number" || lower === "float" || lower === "double") return "number";
  if (lower === "boolean" || lower === "bool") return "boolean";
  return "string";
}

function methodToSwagger(ep: Endpoint): Record<string, unknown> {
  const operation: Record<string, unknown> = {
    summary: ep.description,
    operationId: `${ep.method.toLowerCase()}_${ep.path.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "")}`,
    consumes: ["application/json"],
    produces: ["application/json"],
    parameters: [] as unknown[],
    responses: {},
  };

  if (ep.notes) operation.description = ep.notes;

  const parameters = operation.parameters as unknown[];

  ep.pathParams.forEach((p) => {
    parameters.push({
      name: p.name,
      in: "path",
      required: true,
      description: p.description,
      type: mapType(p.type),
    });
  });

  ep.queryParams.forEach((p) => {
    parameters.push({
      name: p.name,
      in: "query",
      required: p.required,
      description: p.description,
      type: mapType(p.type),
    });
  });

  ep.headers.forEach((h) => {
    parameters.push({
      name: h.name,
      in: "header",
      required: h.required,
      type: "string",
    });
  });

  if (ep.requestBody) {
    parameters.push({
      name: "body",
      in: "body",
      required: true,
      schema: schemaStringToJsonSchema(ep.requestBody.schema),
    });
  }

  if (parameters.length === 0) delete operation.parameters;

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
    schema: responseSchema,
  };

  return operation;
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
  const hintMatch = type.code.match(/\/\/\s*(?:Schema hint|Define schema):\s*(.+)/);
  if (hintMatch) return schemaStringToJsonSchema(hintMatch[1].trim());
  return { type: "object", description: type.name };
}

function parseInterfaceFields(code: string): { name: string; type: string; required: boolean }[] {
  const fields: { name: string; type: string; required: boolean }[] = [];
  for (const line of code.split("\n")) {
    if (line.trim().startsWith("//")) continue;
    const m = line.match(/^\s+(\w+)(\?)?\s*:\s*(.+?);?\s*$/);
    if (m) fields.push({ name: m[1], type: m[3].trim(), required: !m[2] });
  }
  return fields;
}

function tsTypeToJsonSchema(tsType: string): Record<string, unknown> {
  const trimmed = tsType.trim();

  // Nullable: "string | null" → { type: "string", "x-nullable": true } (Swagger 2 convention)
  if (trimmed.includes("| null") || trimmed.includes("null |")) {
    const base = trimmed.replace(/\s*\|\s*null/g, "").replace(/null\s*\|\s*/g, "").trim();
    return { ...tsTypeToJsonSchema(base), "x-nullable": true };
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

function parseTsObjectLiteral(schema: string): { name: string; type: string; required: boolean }[] {
  const fields: { name: string; type: string; required: boolean }[] = [];
  const inner = schema.trim().replace(/^\{|\}$/g, "").trim();
  if (!inner) return fields;
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

function schemaStringToJsonSchema(schema: string): Record<string, unknown> {
  if (!schema || !schema.trim()) return { type: "object" };
  try {
    const parsed = JSON.parse(schema);
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
  } catch { /* fall through */ }
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
  return { type: "object", description: schema.slice(0, 120) };
}

export function generateSwagger(contract: Contract): Record<string, unknown> {
  const enabledEndpoints = contract.endpoints.filter((ep) => ep.enabled);

  const paths: Record<string, Record<string, unknown>> = {};
  for (const ep of enabledEndpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};
    paths[ep.path][ep.method.toLowerCase()] = methodToSwagger(ep);
  }

  const result: Record<string, unknown> = {
    swagger: "2.0",
    info: {
      title: contract.name,
      version: "1.0.0",
      description: contract.jiraStories.length > 0
        ? contract.jiraStories.map((s) => `${s.key ? s.key + ": " : ""}${s.title}`).join(" | ")
        : contract.name,
    },
    basePath: "/",
    schemes: ["https"],
    consumes: ["application/json"],
    produces: ["application/json"],
    paths,
  };

  const definableTypes = contract.generatedTypes.filter(
    (t) => t.name !== "PaginatedResponse"
  );
  if (definableTypes.length > 0) {
    const definitions: Record<string, unknown> = {};
    for (const t of definableTypes) {
      definitions[t.name] = typeToJsonSchema(t);
    }
    result.definitions = definitions;
  }

  return result;
}

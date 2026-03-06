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
    let schemaObj: unknown = { type: "object" };
    try {
      schemaObj = JSON.parse(ep.requestBody.schema);
    } catch {
      /* keep default */
    }
    parameters.push({
      name: "body",
      in: "body",
      required: true,
      schema: schemaObj,
    });
  }

  if (parameters.length === 0) delete operation.parameters;

  const statusCode = ep.responseBody?.statusCode ?? 200;
  let responseSchema: unknown = { type: "object" };
  if (ep.responseBody) {
    try {
      responseSchema = JSON.parse(ep.responseBody.schema);
    } catch {
      /* keep default */
    }
    if (ep.responseBody.isPaginated) {
      responseSchema = {
        type: "object",
        properties: {
          data: { type: "array", items: responseSchema },
          total: { type: "integer" },
          page: { type: "integer" },
          pageSize: { type: "integer" },
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
  if (fields.length === 0) {
    return { type: "object", description: type.name };
  }
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

function parseInterfaceFields(code: string): { name: string; type: string; required: boolean }[] {
  const fields: { name: string; type: string; required: boolean }[] = [];
  for (const line of code.split("\n")) {
    const m = line.match(/^\s+(\w+)(\?)?\s*:\s*(.+?);?\s*$/);
    if (m && !m[1].startsWith("//")) {
      fields.push({ name: m[1], type: m[3].trim(), required: !m[2] });
    }
  }
  return fields;
}

function tsTypeToJsonSchema(tsType: string): Record<string, unknown> {
  const t = tsType.toLowerCase().trim();
  if (t === "string") return { type: "string" };
  if (t === "number" || t === "integer" || t === "int") return { type: "integer" };
  if (t === "float" || t === "double") return { type: "number" };
  if (t === "boolean" || t === "bool") return { type: "boolean" };
  if (t === "unknown" || t === "any") return {};
  if (t.endsWith("[]")) return { type: "array", items: tsTypeToJsonSchema(tsType.slice(0, -2)) };
  return { type: "string", description: tsType };
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

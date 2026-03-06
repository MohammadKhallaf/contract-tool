import type { Contract, Endpoint, GeneratedType } from "@/types";
import {
  extractDataItemShape,
  deriveItemTypeName,
  isUnquotedEnum,
  schemaStringToJsonSchema as sharedSchemaStringToJsonSchema,
  tsTypeToJsonSchema as sharedTsTypeToJsonSchema,
  type JsonSchemaOpts,
} from "./schema-utils";

const SWAGGER_OPTS: JsonSchemaOpts = { nullableKey: "x-nullable" };

function schemaStringToJsonSchema(schema: string): Record<string, unknown> {
  return sharedSchemaStringToJsonSchema(schema, SWAGGER_OPTS);
}

function mapType(t: string): string {
  const lower = t.toLowerCase();
  if (lower === "integer" || lower === "int") return "integer";
  if (lower === "number" || lower === "float" || lower === "double") return "number";
  if (lower === "boolean" || lower === "bool") return "boolean";
  return "string";
}

/** Build Swagger 2 flat param type fields, detecting enums from pipe-separated values */
function paramTypeFields(rawType: string): Record<string, unknown> {
  const trimmed = rawType.trim();
  if (trimmed.includes("|")) {
    const parts = trimmed.split("|").map((s) => s.trim());
    if (isUnquotedEnum(parts)) {
      return { type: "string", enum: parts };
    }
    // Quoted enum
    const quoted = trimmed.match(/"([^"]+)"|'([^']+)'/g);
    if (quoted && quoted.length > 0) {
      return { type: "string", enum: quoted.map((v) => v.replace(/^["']|["']$/g, "")) };
    }
  }
  return { type: mapType(trimmed) };
}

function methodToSwagger(
  ep: Endpoint,
  knownTypes: Set<string>,
  additionalDefinitions: Record<string, unknown>,
): Record<string, unknown> {
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
      ...paramTypeFields(p.type),
    });
  });

  ep.queryParams.forEach((p) => {
    parameters.push({
      name: p.name,
      in: "query",
      required: p.required,
      description: p.description,
      ...paramTypeFields(p.type),
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
    const rawSchema = ep.responseBody.schema ?? "";
    if (ep.responseBody.isPaginated) {
      const dataShape = extractDataItemShape(rawSchema);
      let itemSchema: Record<string, unknown>;

      if (dataShape?.isInline) {
        // Auto-create a $ref definition for the inline item shape
        const defName = deriveItemTypeName(ep.path, ep.method);
        if (!additionalDefinitions[defName]) {
          additionalDefinitions[defName] = schemaStringToJsonSchema(dataShape.itemShape);
        }
        itemSchema = { $ref: `#/definitions/${defName}` };
      } else if (dataShape && !dataShape.isInline && knownTypes.has(dataShape.namedType!)) {
        itemSchema = { $ref: `#/definitions/${dataShape.namedType}` };
      } else {
        itemSchema = { type: "object" };
      }

      responseSchema = {
        type: "object",
        required: ["data", "total", "offset", "itemsPerPage"],
        properties: {
          data: { type: "array", items: itemSchema },
          total: { type: "integer" },
          offset: { type: "integer" },
          itemsPerPage: { type: "integer" },
        },
      };
    } else {
      responseSchema = schemaStringToJsonSchema(rawSchema);
    }
  }

  (operation.responses as Record<string, unknown>)[String(statusCode)] = {
    description: ep.description,
    schema: responseSchema,
  };

  return operation;
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

function typeToJsonSchema(type: GeneratedType): Record<string, unknown> {
  const fields = parseInterfaceFields(type.code);
  if (fields.length > 0) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const f of fields) {
      properties[f.name] = sharedTsTypeToJsonSchema(f.type, SWAGGER_OPTS);
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

export function generateSwagger(contract: Contract): Record<string, unknown> {
  const enabledEndpoints = contract.endpoints.filter((ep) => ep.enabled);
  const definableTypes = contract.generatedTypes.filter((t) => t.name !== "PaginatedResponse");
  const knownTypes = new Set(definableTypes.map((t) => t.name));
  const additionalDefinitions: Record<string, unknown> = {};

  const paths: Record<string, Record<string, unknown>> = {};
  for (const ep of enabledEndpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};
    paths[ep.path][ep.method.toLowerCase()] = methodToSwagger(ep, knownTypes, additionalDefinitions);
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

  // Merge definitions: explicit types + auto-created from inline items
  const definitions: Record<string, unknown> = {};
  for (const t of definableTypes) {
    definitions[t.name] = typeToJsonSchema(t);
  }
  // Merge additional definitions (don't overwrite existing)
  for (const [name, schema] of Object.entries(additionalDefinitions)) {
    if (!definitions[name]) {
      definitions[name] = schema;
    }
  }
  if (Object.keys(definitions).length > 0) {
    result.definitions = definitions;
  }

  return result;
}

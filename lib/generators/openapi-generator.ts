import type { Contract, Endpoint, Annotation, Screen, GeneratedType } from "@/types";
import { getLinkedScreenNames } from "@/lib/utils/screen-links";
import {
  extractDataItemShape,
  deriveItemTypeName,
  isUnquotedEnum,
  schemaStringToJsonSchema as sharedSchemaStringToJsonSchema,
  tsTypeToJsonSchema as sharedTsTypeToJsonSchema,
} from "./schema-utils";

function schemaStringToJsonSchema(schema: string): Record<string, unknown> {
  return sharedSchemaStringToJsonSchema(schema); // OpenAPI 3 default: nullable
}

function methodToOpenApi(
  ep: Endpoint,
  annotations: Annotation[],
  screens: Screen[],
  knownTypes: Set<string>,
  additionalSchemas: Record<string, unknown>,
): Record<string, unknown> {
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
      schema: paramSchema(p.type),
    });
  });

  ep.queryParams.forEach((p) => {
    parameters.push({
      name: p.name,
      in: "query",
      required: p.required,
      description: p.description,
      schema: paramSchema(p.type),
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
    const rawSchema = ep.responseBody.schema ?? "";
    if (ep.responseBody.isPaginated) {
      const dataShape = extractDataItemShape(rawSchema);
      let itemSchema: Record<string, unknown>;

      if (dataShape?.isInline) {
        // Auto-create a $ref schema for the inline item shape
        const schemaName = deriveItemTypeName(ep.path, ep.method);
        if (!additionalSchemas[schemaName]) {
          additionalSchemas[schemaName] = schemaStringToJsonSchema(dataShape.itemShape);
        }
        itemSchema = { $ref: `#/components/schemas/${schemaName}` };
      } else if (dataShape && !dataShape.isInline && knownTypes.has(dataShape.namedType!)) {
        itemSchema = { $ref: `#/components/schemas/${dataShape.namedType}` };
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
    if (line.trim().startsWith("//")) continue;
    const m = line.match(/^\s+(\w+)(\?)?\s*:\s*(.+?);?\s*$/);
    if (m) {
      fields.push({ name: m[1], type: m[3].trim(), required: !m[2] });
    }
  }
  return fields;
}

function typeToJsonSchema(type: GeneratedType): Record<string, unknown> {
  const fields = parseInterfaceFields(type.code);
  if (fields.length > 0) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const f of fields) {
      properties[f.name] = sharedTsTypeToJsonSchema(f.type);
      if (f.required) required.push(f.name);
    }
    const schema: Record<string, unknown> = { type: "object", properties };
    if (required.length > 0) schema.required = required;
    return schema;
  }
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

/** Build OpenAPI 3 schema object for a param, detecting enums from pipe-separated values */
function paramSchema(rawType: string): Record<string, unknown> {
  const trimmed = rawType.trim();
  if (trimmed.includes("|")) {
    const parts = trimmed.split("|").map((s) => s.trim());
    if (isUnquotedEnum(parts)) {
      return { type: "string", enum: parts };
    }
    const quoted = trimmed.match(/"([^"]+)"|'([^']+)'/g);
    if (quoted && quoted.length > 0) {
      return { type: "string", enum: quoted.map((v) => v.replace(/^["']|["']$/g, "")) };
    }
  }
  return { type: mapType(trimmed) };
}

export function generateOpenApi(contract: Contract, serverUrl = "/"): Record<string, unknown> {
  const enabledEndpoints = contract.endpoints.filter((ep) => ep.enabled);
  const definableTypes = contract.generatedTypes.filter((t) => t.name !== "PaginatedResponse");
  const knownTypes = new Set(definableTypes.map((t) => t.name));
  const additionalSchemas: Record<string, unknown> = {};

  const paths: Record<string, Record<string, unknown>> = {};

  for (const ep of enabledEndpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};
    paths[ep.path][ep.method.toLowerCase()] = methodToOpenApi(ep, contract.annotations, contract.screens, knownTypes, additionalSchemas);
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

  // Merge schemas: explicit types + auto-created from inline items
  const schemas: Record<string, unknown> = {};
  for (const t of definableTypes) {
    schemas[t.name] = typeToJsonSchema(t);
  }
  // Merge additional schemas (don't overwrite existing)
  for (const [name, schema] of Object.entries(additionalSchemas)) {
    if (!schemas[name]) {
      schemas[name] = schema;
    }
  }
  if (Object.keys(schemas).length > 0) {
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

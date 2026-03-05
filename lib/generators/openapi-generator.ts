import type { Contract, Endpoint } from "@/types";

function methodToOpenApi(ep: Endpoint): Record<string, unknown> {
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
    let schemaObj: unknown = { type: "object" };
    try { schemaObj = JSON.parse(ep.requestBody.schema); } catch { /* keep default */ }
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
    try { responseSchema = JSON.parse(ep.responseBody.schema); } catch { /* keep default */ }
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
    content: { "application/json": { schema: responseSchema } },
  };

  if (ep.notes) operation.description = ep.notes;

  return operation;
}

function mapType(t: string): string {
  const lower = t.toLowerCase();
  if (lower === "number" || lower === "integer" || lower === "int") return "integer";
  if (lower === "float" || lower === "double") return "number";
  if (lower === "boolean" || lower === "bool") return "boolean";
  return "string";
}

export function generateOpenApi(contract: Contract): Record<string, unknown> {
  const enabledEndpoints = contract.endpoints.filter((ep) => ep.enabled);

  const paths: Record<string, Record<string, unknown>> = {};

  for (const ep of enabledEndpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};
    paths[ep.path][ep.method.toLowerCase()] = methodToOpenApi(ep);
  }

  const spec: Record<string, unknown> = {
    openapi: "3.0.3",
    info: {
      title: contract.name,
      version: "1.0.0",
      description: contract.jiraStory
        ? `${contract.jiraStory.key ? contract.jiraStory.key + ": " : ""}${contract.jiraStory.title}`
        : contract.name,
    },
    paths,
  };

  if (contract.generatedTypes.length > 0 || contract.generatedSchemas.length > 0) {
    spec["x-typescript-types"] = contract.generatedTypes.map((t) => ({
      name: t.name,
      code: t.code,
    }));
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

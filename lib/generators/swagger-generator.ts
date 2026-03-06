import type { Contract, Endpoint } from "@/types";

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

export function generateSwagger(contract: Contract): Record<string, unknown> {
  const enabledEndpoints = contract.endpoints.filter((ep) => ep.enabled);

  const paths: Record<string, Record<string, unknown>> = {};
  for (const ep of enabledEndpoints) {
    if (!paths[ep.path]) paths[ep.path] = {};
    paths[ep.path][ep.method.toLowerCase()] = methodToSwagger(ep);
  }

  return {
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
}

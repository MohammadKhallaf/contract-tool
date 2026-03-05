import type { ParsedSpec, SpecEndpoint, SpecSchema } from "@/types";

// Resolve $ref within the same document
function resolveRef(
  ref: string,
  doc: Record<string, unknown>
): Record<string, unknown> {
  const parts = ref.replace(/^#\//, "").split("/");
  let node: unknown = doc;
  for (const part of parts) {
    if (typeof node === "object" && node !== null) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return {};
    }
  }
  return (node as Record<string, unknown>) ?? {};
}

function resolveSchema(
  schema: unknown,
  doc: Record<string, unknown>
): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return {};
  const s = schema as Record<string, unknown>;
  if (s.$ref && typeof s.$ref === "string") {
    return resolveRef(s.$ref, doc);
  }
  return s;
}

export function parseSpec(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any,
  project: string,
  url: string
): ParsedSpec {
  const doc = raw as Record<string, unknown>;
  const info = (doc.info as Record<string, unknown>) ?? {};
  const paths = (doc.paths as Record<string, unknown>) ?? {};
  const components = (doc.components as Record<string, unknown>) ?? {};
  const schemasRaw =
    (components.schemas as Record<string, unknown>) ?? {};

  const endpoints: SpecEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    const methods = [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "head",
      "options",
    ];
    for (const method of methods) {
      const op = (pathItem as Record<string, unknown>)[method];
      if (!op || typeof op !== "object") continue;
      const operation = op as Record<string, unknown>;

      const parameters = ((operation.parameters as unknown[]) ?? []).map(
        (p) => {
          const param = p as Record<string, unknown>;
          return {
            name: String(param.name ?? ""),
            in: String(param.in ?? "query") as "path" | "query" | "header" | "cookie",
            required: Boolean(param.required),
            schema: resolveSchema(param.schema, doc) as { type: string },
            description: param.description as string | undefined,
          };
        }
      );

      const responses: { statusCode: number; description?: string; schema?: Record<string, unknown> }[] = [];
      const responsesRaw = (operation.responses as Record<string, unknown>) ?? {};
      for (const [code, resp] of Object.entries(responsesRaw)) {
        const respObj = resp as Record<string, unknown>;
        const content = (respObj.content as Record<string, unknown>) ?? {};
        const jsonContent = (content["application/json"] as Record<string, unknown>) ?? {};
        const schema = jsonContent.schema
          ? resolveSchema(jsonContent.schema, doc)
          : undefined;
        responses.push({
          statusCode: parseInt(code, 10) || 200,
          description: respObj.description as string | undefined,
          schema,
        });
      }

      let requestBody: SpecEndpoint["requestBody"];
      if (operation.requestBody) {
        const rb = operation.requestBody as Record<string, unknown>;
        const content = (rb.content as Record<string, unknown>) ?? {};
        const contentType = Object.keys(content)[0] ?? "application/json";
        const jsonContent = (content[contentType] as Record<string, unknown>) ?? {};
        requestBody = {
          required: Boolean(rb.required),
          contentType,
          schema: jsonContent.schema
            ? resolveSchema(jsonContent.schema, doc)
            : undefined,
        };
      }

      endpoints.push({
        method: method.toUpperCase(),
        path,
        operationId: operation.operationId as string | undefined,
        summary: operation.summary as string | undefined,
        description: operation.description as string | undefined,
        tags: operation.tags as string[] | undefined,
        parameters,
        requestBody,
        responses,
      });
    }
  }

  const schemas: SpecSchema[] = Object.entries(schemasRaw).map(
    ([name, schema]) => {
      const s = schema as Record<string, unknown>;
      const properties =
        (s.properties as Record<
          string,
          { type: string; description?: string; $ref?: string }
        >) ?? {};
      const required = s.required as string[] | undefined;
      return { name, properties, required };
    }
  );

  return {
    project,
    url,
    title: info.title as string | undefined,
    version: info.version as string | undefined,
    endpoints,
    schemas,
    fetchedAt: new Date().toISOString(),
  };
}

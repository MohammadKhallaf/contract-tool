import type { Endpoint, GeneratedType } from "@/types";

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

function pathToResource(path: string): string {
  const segments = path.split("/").filter(Boolean);
  // Remove path params like {id}
  const noParams = segments.filter((s) => !s.startsWith("{"));
  const last = noParams[noParams.length - 1] ?? "Resource";
  return toPascalCase(last);
}

export function generateTypes(
  endpoints: Endpoint[],
  existing: GeneratedType[]
): GeneratedType[] {
  const result: GeneratedType[] = [];

  for (const ep of endpoints) {
    if (!ep.enabled) continue;

    const resource = pathToResource(ep.path);
    const prefix = `${methodPrefix(ep.method)}${resource}`;

    // Request type
    const requestName = `${prefix}Request`;
    const existingReq = existing.find((t) => t.name === requestName);
    if (!existingReq || !existingReq.isEdited) {
      const fields: string[] = [];

      // Path params
      ep.pathParams.forEach((p) => {
        fields.push(`  ${p.name}${p.required ? "" : "?"}: ${p.type || "string"};`);
      });

      // Query params
      ep.queryParams.forEach((p) => {
        fields.push(`  ${p.name}${p.required ? "" : "?"}: ${p.type || "string"};`);
      });

      // Request body fields (if schema is a simple string, use it)
      if (ep.requestBody?.schema) {
        fields.push(`  // ${ep.requestBody.contentType}`);
        fields.push(`  body?: unknown; // Define schema: ${ep.requestBody.schema.slice(0, 80)}`);
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
        code = `export interface ${responseName}Item {\n  // TODO: define response shape\n  id: string;\n}\n\nexport type ${responseName} = PaginatedResponse<${responseName}Item>;`;
      } else {
        code = `export interface ${responseName} {\n  // TODO: define response shape${schema ? `\n  // Schema hint: ${schema.slice(0, 80)}` : ""}\n}`;
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
        code: `export interface PaginatedResponse<T> {\n  data: T[];\n  total: number;\n  page: number;\n  pageSize: number;\n  hasNextPage: boolean;\n}`,
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

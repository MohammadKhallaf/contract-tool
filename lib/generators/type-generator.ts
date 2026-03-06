import type { Endpoint, GeneratedType } from "@/types";

function parseSchemaToFields(schema: string): string[] {
  const trimmed = schema.trim();
  // Match TypeScript object literal: { key: type, key?: type, ... }
  const inner = trimmed.match(/^\{([\s\S]*)\}$/)?.[1];
  if (!inner) return [`  body?: unknown; // ${trimmed.slice(0, 80)}`];

  const fields: string[] = [];
  // Split on commas or semicolons not inside nested braces/parens
  const entries = inner.split(/[,;]\s*(?=[a-zA-Z_$"'])/).map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    const m = entry.match(/^["']?(\w+)["']?(\?)?\s*:\s*(.+)$/);
    if (!m) continue;
    const [, name, optional, rawType] = m;
    const type = rawType.trim().replace(/,$/, "");
    const isNullable = type.includes("null");
    // Nullable fields: no `?`, use `type | null` directly
    const opt = isNullable ? "" : (optional ?? "?");
    fields.push(`  ${name}${opt}: ${type};`);
  }
  return fields.length > 0 ? fields : [`  body?: unknown; // ${trimmed.slice(0, 80)}`];
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
        if (p.description) fields.push(`  /** ${p.description} */`);
        const isNullable = (p.type ?? "").includes("null");
        fields.push(`  ${p.name}${p.required && !isNullable ? "" : "?"}: ${p.type || "string"};`);
      });

      // Query params
      ep.queryParams.forEach((p) => {
        if (p.description) fields.push(`  /** ${p.description} */`);
        const isNullable = (p.type ?? "").includes("null");
        fields.push(`  ${p.name}${p.required && !isNullable ? "" : "?"}: ${p.type || "string"};`);
      });

      // Request body fields — parse schema into typed fields
      if (ep.requestBody?.schema) {
        const parsed = parseSchemaToFields(ep.requestBody.schema);
        fields.push(...parsed);
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
        const itemFields = schema ? parseSchemaToFields(schema) : ["  id: string;"];
        code = `export interface ${responseName}Item {\n${itemFields.join("\n")}\n}\n\nexport type ${responseName} = PaginatedResponse<${responseName}Item>;`;
      } else if (schema) {
        const respFields = parseSchemaToFields(schema);
        code = `export interface ${responseName} {\n${respFields.join("\n")}\n}`;
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

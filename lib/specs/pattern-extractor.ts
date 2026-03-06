import type { ParsedSpec } from "@/types";

export interface PatternItem {
  id: string;
  kind: "auth_header" | "pagination" | "common_schema" | "error_shape" | "naming_prefix";
  label: string;
  description: string;
  promptSnippet: string;
  weight: number;
  enabled: boolean;
  sourceProjects: string[];
}

function stableId(kind: string, label: string): string {
  const raw = `${kind}:${label}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `pat_${hash.toString(36)}`;
}

export function extractPatterns(specs: ParsedSpec[]): PatternItem[] {
  const patterns: PatternItem[] = [];

  // --- auth_header ---
  const authSchemes = new Map<string, Set<string>>();
  for (const spec of specs) {
    for (const ep of spec.endpoints) {
      for (const param of ep.parameters) {
        if (param.in !== "header") continue;
        const name = param.name.toLowerCase();
        if (name.includes("authorization") || name.includes("bearer") || name.includes("x-auth") || name.includes("api-key") || name.includes("x-api-key")) {
          const key = param.name;
          if (!authSchemes.has(key)) authSchemes.set(key, new Set());
          authSchemes.get(key)!.add(spec.project);
        }
      }
    }
  }
  for (const [headerName, projects] of authSchemes) {
    const isBearer = headerName.toLowerCase().includes("authorization");
    const label = isBearer ? "Bearer auth header" : `Auth header: ${headerName}`;
    const snippet = isBearer
      ? `Auth: All protected endpoints must include the header "Authorization: Bearer <token>".`
      : `Auth: All protected endpoints must include the header "${headerName}: <value>".`;
    patterns.push({
      id: stableId("auth_header", label),
      kind: "auth_header",
      label,
      description: `Detected in header parameters across ${projects.size} project(s).`,
      promptSnippet: snippet,
      weight: 1.0,
      enabled: true,
      sourceProjects: [...projects],
    });
  }

  // --- pagination ---
  const paginationProjects = new Set<string>();
  const paginationKeys = ["data", "total", "page", "pagesize", "page_size", "hasnextpage", "has_next_page", "items", "results", "count"];
  for (const spec of specs) {
    for (const schema of spec.schemas) {
      const keys = Object.keys(schema.properties).map((k) => k.toLowerCase());
      const hasData = keys.some((k) => k === "data" || k === "items" || k === "results");
      const hasTotal = keys.some((k) => k === "total" || k === "count");
      const hasPaging = keys.some((k) => paginationKeys.includes(k) && k !== "data" && k !== "items" && k !== "results");
      if (hasData && (hasTotal || hasPaging)) {
        paginationProjects.add(spec.project);
      }
    }
    // Also check response schemas inline
    for (const ep of spec.endpoints) {
      for (const resp of ep.responses) {
        if (!resp.schema || typeof resp.schema !== "object") continue;
        const props = (resp.schema as Record<string, unknown>).properties;
        if (!props || typeof props !== "object") continue;
        const keys = Object.keys(props as object).map((k) => k.toLowerCase());
        const hasData = keys.some((k) => k === "data" || k === "items" || k === "results");
        const hasTotal = keys.some((k) => k === "total" || k === "count");
        if (hasData && hasTotal) {
          paginationProjects.add(spec.project);
        }
      }
    }
  }
  if (paginationProjects.size > 0) {
    patterns.push({
      id: stableId("pagination", "Pagination envelope"),
      kind: "pagination",
      label: "Pagination envelope",
      description: `Pagination response shape detected in ${paginationProjects.size} project(s).`,
      promptSnippet: `Pagination: Endpoints that return lists must use this response envelope: { data: T[], total: number, page: number, pageSize: number, hasNextPage: boolean }`,
      weight: 1.0,
      enabled: true,
      sourceProjects: [...paginationProjects],
    });
  }

  // --- common_schema ---
  // Count how many endpoints (across all specs) reference a schema by name in their responses
  const schemaEndpointCount = new Map<string, { projects: Set<string>; schema: ParsedSpec["schemas"][number] }>();
  for (const spec of specs) {
    for (const schema of spec.schemas) {
      if (!schemaEndpointCount.has(schema.name)) {
        schemaEndpointCount.set(schema.name, { projects: new Set(), schema });
      }
    }
  }
  // Count endpoint references per schema name
  const schemaRefCount = new Map<string, Set<string>>();
  for (const spec of specs) {
    for (const ep of spec.endpoints) {
      for (const resp of ep.responses) {
        const schema = resp.schema as Record<string, unknown> | undefined;
        if (!schema) continue;
        // Check $ref
        const ref = schema.$ref as string | undefined;
        if (ref) {
          const name = ref.split("/").pop() ?? "";
          if (!schemaRefCount.has(name)) schemaRefCount.set(name, new Set());
          schemaRefCount.get(name)!.add(spec.project);
        }
        // Check allOf/oneOf/anyOf
        for (const key of ["allOf", "oneOf", "anyOf"]) {
          const arr = schema[key] as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(arr)) {
            for (const item of arr) {
              const itemRef = item.$ref as string | undefined;
              if (itemRef) {
                const name = itemRef.split("/").pop() ?? "";
                if (!schemaRefCount.has(name)) schemaRefCount.set(name, new Set());
                schemaRefCount.get(name)!.add(spec.project);
              }
            }
          }
        }
      }
    }
  }

  for (const [name, { projects, schema }] of schemaEndpointCount) {
    const refProjects = schemaRefCount.get(name) ?? new Set();
    const allProjects = new Set([...projects, ...refProjects]);
    if (allProjects.size < 2) continue; // only surface schemas used across 2+ projects
    const propList = Object.entries(schema.properties)
      .slice(0, 8)
      .map(([k, v]) => `${k}: ${v.type || "unknown"}`)
      .join(", ");
    patterns.push({
      id: stableId("common_schema", name),
      kind: "common_schema",
      label: `Shared schema: ${name}`,
      description: `Appears in ${allProjects.size} project(s). Properties: ${propList || "none"}.`,
      promptSnippet: `Common type "${name}": { ${propList} } — reuse this type in responses where applicable.`,
      weight: 1.0,
      enabled: true,
      sourceProjects: [...allProjects],
    });
  }

  // --- error_shape ---
  const errorProjects = new Set<string>();
  const errorShapes = new Map<string, number>();
  for (const spec of specs) {
    for (const ep of spec.endpoints) {
      for (const resp of ep.responses) {
        if (resp.statusCode < 400) continue;
        const schema = resp.schema as Record<string, unknown> | undefined;
        if (!schema || !schema.properties) continue;
        const props = schema.properties as Record<string, unknown>;
        const keys = Object.keys(props).sort().join(",");
        errorShapes.set(keys, (errorShapes.get(keys) ?? 0) + 1);
        errorProjects.add(spec.project);
      }
    }
  }
  if (errorProjects.size > 0) {
    // Pick the most common error shape
    let bestShape = "";
    let bestCount = 0;
    for (const [shape, count] of errorShapes) {
      if (count > bestCount) { bestCount = count; bestShape = shape; }
    }
    const shapeDisplay = bestShape
      ? bestShape.split(",").map((k) => `${k}: string`).join(", ")
      : "message: string, code: string";
    patterns.push({
      id: stableId("error_shape", "Standard error shape"),
      kind: "error_shape",
      label: "Standard error shape",
      description: `4xx/5xx error response shape detected across ${errorProjects.size} project(s).`,
      promptSnippet: `Error responses (4xx/5xx): Always return { ${shapeDisplay} } for error cases.`,
      weight: 1.0,
      enabled: true,
      sourceProjects: [...errorProjects],
    });
  }

  // --- naming_prefix ---
  const prefixCount = new Map<string, Set<string>>();
  for (const spec of specs) {
    for (const ep of spec.endpoints) {
      const parts = ep.path.split("/").filter(Boolean);
      // Extract prefixes like /api/v1, /api, /v2
      for (let len = 1; len <= Math.min(3, parts.length - 1); len++) {
        const prefix = "/" + parts.slice(0, len).join("/");
        if (!prefixCount.has(prefix)) prefixCount.set(prefix, new Set());
        prefixCount.get(prefix)!.add(spec.project);
      }
    }
  }
  // Find prefixes present in 2+ projects with 3+ endpoints each
  const endpointsByPrefix = new Map<string, number>();
  for (const spec of specs) {
    for (const ep of spec.endpoints) {
      for (const [prefix] of prefixCount) {
        if (ep.path.startsWith(prefix)) {
          endpointsByPrefix.set(prefix, (endpointsByPrefix.get(prefix) ?? 0) + 1);
        }
      }
    }
  }
  for (const [prefix, projects] of prefixCount) {
    if (projects.size < 2) continue;
    const count = endpointsByPrefix.get(prefix) ?? 0;
    if (count < 3) continue;
    patterns.push({
      id: stableId("naming_prefix", prefix),
      kind: "naming_prefix",
      label: `Base path: ${prefix}`,
      description: `Used in ${projects.size} project(s) across ${count} endpoints.`,
      promptSnippet: `Base path convention: All API endpoints should be prefixed with "${prefix}".`,
      weight: 1.0,
      enabled: true,
      sourceProjects: [...projects],
    });
  }

  return patterns;
}

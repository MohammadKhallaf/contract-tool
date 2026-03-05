import Fuse from "fuse.js";
import type { ParsedSpec, SpecEndpoint } from "@/types";
import type { ConfidenceInfo } from "@/types";

interface IndexedEndpoint extends SpecEndpoint {
  project: string;
  searchKey: string;
}

export function buildFuseIndex(specs: ParsedSpec[]): Fuse<IndexedEndpoint> {
  const items: IndexedEndpoint[] = specs.flatMap((spec) =>
    spec.endpoints.map((ep) => ({
      ...ep,
      project: spec.project,
      searchKey: `${ep.method} ${ep.path} ${ep.summary ?? ""} ${ep.operationId ?? ""} ${(ep.tags ?? []).join(" ")}`,
    }))
  );

  return new Fuse(items, {
    keys: ["searchKey", "path", "operationId", "summary"],
    threshold: 0.4,
    includeScore: true,
  });
}

export function matchEndpoint(
  fuse: Fuse<IndexedEndpoint>,
  query: string
): ConfidenceInfo {
  const results = fuse.search(query, { limit: 1 });
  if (!results.length || results[0].score === undefined) {
    return { level: "low", score: 0, reason: "No matching spec endpoint found" };
  }

  const score = 1 - results[0].score; // fuse score: 0=perfect, 1=no match → invert
  const ep = results[0].item;
  const matchedEndpoint = `${ep.method} ${ep.path}`;

  if (score >= 0.75) {
    return { level: "high", score, matchedEndpoint, reason: "Strong match in spec" };
  }
  if (score >= 0.5) {
    return { level: "medium", score, matchedEndpoint, reason: "Partial match in spec" };
  }
  return { level: "low", score, matchedEndpoint, reason: "Weak match — verify manually" };
}

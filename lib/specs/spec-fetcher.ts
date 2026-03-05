import { proxySpecUrl, projectFromUrl, SPEC_TTL_MS } from "@/lib/constants";
import type { ParsedSpec } from "@/types";
import { parseSpec } from "./spec-parser";

export type FetchStatus = "idle" | "loading" | "cached" | "stale" | "error";

export function getSpecStatus(spec: ParsedSpec | undefined): FetchStatus {
  if (!spec) return "idle";
  const age = Date.now() - new Date(spec.fetchedAt).getTime();
  return age > SPEC_TTL_MS ? "stale" : "cached";
}

export async function fetchSpec(url: string): Promise<ParsedSpec> {
  const project = projectFromUrl(url);
  const proxyUrl = proxySpecUrl(project);

  const res = await fetch(proxyUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch spec for ${project}: ${res.statusText}`);
  }
  const raw = await res.json();
  return parseSpec(raw, project, url);
}

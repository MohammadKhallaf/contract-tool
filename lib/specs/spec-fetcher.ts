import { proxySpecUrl, projectFromUrl, SPEC_TTL_MS } from "@/lib/constants";
import { SPEC_URLS } from "@/stores/settings-store";
import type { ParsedSpec } from "@/types";
import { parseSpec } from "./spec-parser";

export type FetchStatus = "idle" | "loading" | "cached" | "stale" | "error";

export function getSpecStatus(spec: ParsedSpec | undefined): FetchStatus {
  if (!spec) return "idle";
  const age = Date.now() - new Date(spec.fetchedAt).getTime();
  return age > SPEC_TTL_MS ? "stale" : "cached";
}

export function isBuiltinUrl(url: string): boolean {
  return (SPEC_URLS as readonly string[]).includes(url);
}

export async function fetchSpec(url: string): Promise<ParsedSpec> {
  const project = projectFromUrl(url);

  // Built-in URLs use the dedicated proxy rewrite; user-added URLs use the generic proxy
  const proxyUrl = isBuiltinUrl(url)
    ? proxySpecUrl(project)
    : `/api/proxy-fetch?url=${encodeURIComponent(url)}`;

  const res = await fetch(proxyUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch spec for ${project}: ${res.statusText}`);
  }
  const raw = await res.json();
  return parseSpec(raw, project, url);
}

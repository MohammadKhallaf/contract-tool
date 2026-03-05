export const SPEC_PROJECTS = [
  "digitalcard-core",
  "digitalcard-front-end",
  "meetingplatform-dashboard",
  "submission-log",
  "digitalcard-portal",
  "freemium-webapp-frontend",
  "freemium-activation-flow",
] as const;

export type SpecProject = (typeof SPEC_PROJECTS)[number];

export function proxySpecUrl(project: string) {
  return `/api/proxy-spec/${project}`;
}

export function projectFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.searchParams.get("project") ?? url;
  } catch {
    return url;
  }
}

export const SPEC_TTL_MS = 1000 * 60 * 60; // 1 hour

export const STORAGE_KEYS = {
  SETTINGS: "contract-tool-settings",
  ACTIVE_CONTRACT: "contract-tool-active-contract",
  CONTRACTS_LIST: "contract-tool-contracts-list",
  SPECS: "contract-tool-specs",
} as const;

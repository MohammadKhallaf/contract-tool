import type { Endpoint, Annotation, Screen } from "@/types";

export function getLinkedScreenIds(endpoint: Endpoint, annotations: Annotation[]): string[] {
  const fromAnnotations = annotations
    .filter((a) => a.endpointId === endpoint.id)
    .map((a) => a.screenId);
  return [...new Set([...endpoint.linkedScreenIds, ...fromAnnotations])];
}

export function buildScreenEndpointMap(
  endpoints: Endpoint[],
  annotations: Annotation[]
): Map<string, Endpoint[]> {
  const map = new Map<string, Endpoint[]>();
  for (const ep of endpoints) {
    for (const screenId of getLinkedScreenIds(ep, annotations)) {
      if (!map.has(screenId)) map.set(screenId, []);
      map.get(screenId)!.push(ep);
    }
  }
  return map;
}

export function getLinkedScreenNames(
  endpoint: Endpoint,
  annotations: Annotation[],
  screens: Screen[]
): string[] {
  return getLinkedScreenIds(endpoint, annotations)
    .map((id) => screens.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];
}

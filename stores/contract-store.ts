"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Contract,
  Endpoint,
  Screen,
  Annotation,
  GeneratedType,
  GeneratedSchema,
  JiraStory,
  HttpMethod,
} from "@/types";

function makeId() {
  return crypto.randomUUID();
}

interface ContractState {
  contract: Contract | null;
  // lifecycle
  createContract: (name: string) => Contract;
  loadContract: (contract: Contract) => void;
  updateName: (name: string) => void;
  // jira
  setJiraStory: (story: JiraStory) => void;
  // screens
  addScreen: (screen: Omit<Screen, "id" | "annotationIds">) => string;
  removeScreen: (id: string) => void;
  // annotations
  addAnnotation: (
    ann: Omit<Annotation, "id" | "number">
  ) => string;
  moveAnnotation: (id: string, x: number, y: number) => void;
  linkAnnotation: (annotationId: string, endpointId: string | undefined) => void;
  removeAnnotation: (id: string) => void;
  // endpoints
  addEndpoint: (
    ep: Omit<Endpoint, "id" | "enabled" | "isAiGenerated">
  ) => string;
  addEndpoints: (eps: Partial<Endpoint>[]) => void;
  updateEndpoint: (id: string, ep: Partial<Endpoint>) => void;
  toggleEndpoint: (id: string) => void;
  removeEndpoint: (id: string) => void;
  // types
  setGeneratedTypes: (types: GeneratedType[]) => void;
  updateType: (id: string, changes: Partial<GeneratedType>) => void;
  // schemas
  setGeneratedSchemas: (schemas: GeneratedSchema[]) => void;
  updateSchema: (id: string, changes: Partial<GeneratedSchema>) => void;
}

export const useContractStore = create<ContractState>()(
  persist(
    (set, get) => ({
      contract: null,

      createContract: (name) => {
        const contract: Contract = {
          id: makeId(),
          name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          screens: [],
          annotations: [],
          endpoints: [],
          generatedTypes: [],
          generatedSchemas: [],
        };
        set({ contract });
        return contract;
      },

      loadContract: (contract) => set({ contract }),

      updateName: (name) =>
        set((s) =>
          s.contract
            ? { contract: { ...s.contract, name, updatedAt: new Date().toISOString() } }
            : s
        ),

      setJiraStory: (story) =>
        set((s) =>
          s.contract
            ? { contract: { ...s.contract, jiraStory: story, updatedAt: new Date().toISOString() } }
            : s
        ),

      addScreen: (screen) => {
        const id = makeId();
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  screens: [...s.contract.screens, { ...screen, id, annotationIds: [] }],
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        );
        return id;
      },

      removeScreen: (id) =>
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  screens: s.contract.screens.filter((sc) => sc.id !== id),
                  annotations: s.contract.annotations.filter((a) => a.screenId !== id),
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        ),

      addAnnotation: (ann) => {
        const id = makeId();
        const { contract } = get();
        if (!contract) return id;
        const screenAnns = contract.annotations.filter(
          (a) => a.screenId === ann.screenId
        );
        const number = screenAnns.length + 1;
        const newAnn: Annotation = { ...ann, id, number };
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  annotations: [...s.contract.annotations, newAnn],
                  screens: s.contract.screens.map((sc) =>
                    sc.id === ann.screenId
                      ? { ...sc, annotationIds: [...sc.annotationIds, id] }
                      : sc
                  ),
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        );
        return id;
      },

      moveAnnotation: (id, x, y) =>
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  annotations: s.contract.annotations.map((a) =>
                    a.id === id ? { ...a, x, y } : a
                  ),
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        ),

      linkAnnotation: (annotationId, endpointId) =>
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  annotations: s.contract.annotations.map((a) =>
                    a.id === annotationId ? { ...a, endpointId } : a
                  ),
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        ),

      removeAnnotation: (id) =>
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  annotations: s.contract.annotations.filter((a) => a.id !== id),
                  screens: s.contract.screens.map((sc) => ({
                    ...sc,
                    annotationIds: sc.annotationIds.filter((aid) => aid !== id),
                  })),
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        ),

      addEndpoint: (ep) => {
        const id = makeId();
        const newEp: Endpoint = {
          ...ep,
          id,
          enabled: true,
          isAiGenerated: false,
          pathParams: ep.pathParams ?? [],
          queryParams: ep.queryParams ?? [],
          headers: ep.headers ?? [],
          linkedScreenIds: ep.linkedScreenIds ?? [],
        };
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  endpoints: [...s.contract.endpoints, newEp],
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        );
        return id;
      },

      addEndpoints: (eps) => {
        const newEps: Endpoint[] = eps.map((ep) => ({
          id: makeId(),
          method: (ep.method as HttpMethod) ?? "GET",
          path: ep.path ?? "",
          description: ep.description ?? "",
          enabled: true,
          isAiGenerated: true,
          pathParams: ep.pathParams ?? [],
          queryParams: ep.queryParams ?? [],
          headers: ep.headers ?? [],
          linkedScreenIds: ep.linkedScreenIds ?? [],
          confidence: ep.confidence,
          requestBody: ep.requestBody,
          responseBody: ep.responseBody,
          notes: ep.notes,
        }));
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  endpoints: [...s.contract.endpoints, ...newEps],
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        );
      },

      updateEndpoint: (id, ep) =>
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  endpoints: s.contract.endpoints.map((e) =>
                    e.id === id ? { ...e, ...ep } : e
                  ),
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        ),

      toggleEndpoint: (id) =>
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  endpoints: s.contract.endpoints.map((e) =>
                    e.id === id ? { ...e, enabled: !e.enabled } : e
                  ),
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        ),

      removeEndpoint: (id) =>
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  endpoints: s.contract.endpoints.filter((e) => e.id !== id),
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        ),

      setGeneratedTypes: (types) =>
        set((s) =>
          s.contract
            ? { contract: { ...s.contract, generatedTypes: types, updatedAt: new Date().toISOString() } }
            : s
        ),

      updateType: (id, changes) =>
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  generatedTypes: s.contract.generatedTypes.map((t) =>
                    t.id === id ? { ...t, ...changes } : t
                  ),
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        ),

      setGeneratedSchemas: (schemas) =>
        set((s) =>
          s.contract
            ? { contract: { ...s.contract, generatedSchemas: schemas, updatedAt: new Date().toISOString() } }
            : s
        ),

      updateSchema: (id, changes) =>
        set((s) =>
          s.contract
            ? {
                contract: {
                  ...s.contract,
                  generatedSchemas: s.contract.generatedSchemas.map((sc) =>
                    sc.id === id ? { ...sc, ...changes } : sc
                  ),
                  updatedAt: new Date().toISOString(),
                },
              }
            : s
        ),
    }),
    { name: "contract-tool-active-contract" }
  )
);

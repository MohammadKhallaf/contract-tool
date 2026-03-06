import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIProviderType } from "@/types";

const SPEC_URLS = [
  "https://staging-api2.leadliaison.com/api/specs.json?project=digitalcard-core",
  "https://staging-api2.leadliaison.com/api/specs.json?project=digitalcard-front-end",
  "https://staging-api2.leadliaison.com/api/specs.json?project=meetingplatform-dashboard",
  "https://staging-api2.leadliaison.com/api/specs.json?project=submission-log",
  "https://staging-api2.leadliaison.com/api/specs.json?project=digitalcard-portal",
  "https://staging-api2.leadliaison.com/api/specs.json?project=freemium-webapp-frontend",
  "https://staging-api2.leadliaison.com/api/specs.json?project=freemium-activation-flow",
];

interface SettingsState {
  aiProvider: AIProviderType;
  apiKey: string;
  model: string;       // primary model for all AI tasks (single-call flow by default)
  textModel: string;   // optional override — when set, enables 2-step cost-saving mode (vision describes, this model generates)
  specUrls: string[];
  setAiProvider: (provider: AIProviderType) => void;
  setApiKey: (key: string) => void;
  setModel: (model: string) => void;
  setTextModel: (model: string) => void;
  addSpecUrl: (url: string) => void;
  removeSpecUrl: (url: string) => void;
  resetSpecUrls: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      aiProvider: "manual",
      apiKey: "",
      model: "",
      textModel: "",
      specUrls: SPEC_URLS,
      setAiProvider: (provider) => set({ aiProvider: provider }),
      setApiKey: (key) => set({ apiKey: key }),
      setModel: (model) => set({ model }),
      setTextModel: (textModel) => set({ textModel }),
      addSpecUrl: (url) =>
        set((state) => ({ specUrls: [...state.specUrls, url] })),
      removeSpecUrl: (url) =>
        set((state) => ({ specUrls: state.specUrls.filter((u) => u !== url) })),
      resetSpecUrls: () => set({ specUrls: SPEC_URLS }),
    }),
    { name: "contract-tool-settings" }
  )
);

export { SPEC_URLS };

import type { AIProviderType } from "./common";
import type { Endpoint } from "./contract";

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  model?: string;
}

export interface AIAnalysisRequest {
  jiraStory: string;
  screenDataUrls?: string[];
  existingPatterns?: string;
  screenContext?: string;
  stackContext?: string;
  patternsContext?: string;
}

export interface AIAnalysisResponse {
  endpoints: Partial<Endpoint>[];
  reasoning?: string;
  raw?: string;
}

// AI session types for review & chat

export type AIMessageRole = "user" | "assistant";

export interface AIMessage {
  id: string;
  role: AIMessageRole;
  content: string;
  endpoints?: Partial<Endpoint>[];
  timestamp: number;
}

export type StagedEndpointStatus = "new" | "modified" | "unchanged" | "removed";

export interface StagedEndpoint {
  endpoint: Partial<Endpoint>;
  status: StagedEndpointStatus;
  accepted: boolean;
}

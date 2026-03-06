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

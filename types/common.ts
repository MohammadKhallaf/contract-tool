export type ConfidenceLevel = "high" | "medium" | "low";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ExportFormat = "markdown" | "json";

export type AIProviderType = "claude" | "openai" | "poe" | "manual";

export interface ConfidenceInfo {
  level: ConfidenceLevel;
  score: number;
  matchedEndpoint?: string;
  reason?: string;
}

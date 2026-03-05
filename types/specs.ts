export interface SpecParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
  schema?: { type: string; enum?: string[] };
  description?: string;
}

export interface SpecRequestBody {
  required: boolean;
  contentType: string;
  schema?: Record<string, unknown>;
}

export interface SpecResponse {
  statusCode: number;
  description?: string;
  schema?: Record<string, unknown>;
}

export interface SpecEndpoint {
  method: string;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters: SpecParameter[];
  requestBody?: SpecRequestBody;
  responses: SpecResponse[];
}

export interface SpecSchema {
  name: string;
  properties: Record<string, { type: string; description?: string; $ref?: string }>;
  required?: string[];
}

export interface ParsedSpec {
  project: string;
  url: string;
  title?: string;
  version?: string;
  endpoints: SpecEndpoint[];
  schemas: SpecSchema[];
  fetchedAt: string;
}

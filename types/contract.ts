import type { ConfidenceInfo, HttpMethod } from "./common";

export interface ParamDefinition {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface HeaderDefinition {
  name: string;
  value: string;
  required: boolean;
}

export interface RequestBodyDefinition {
  contentType: string;
  schema: string;
}

export interface ResponseBodyDefinition {
  statusCode: number;
  schema: string;
  isPaginated: boolean;
}

export interface Endpoint {
  id: string;
  method: HttpMethod;
  path: string;
  description: string;
  enabled: boolean;
  pathParams: ParamDefinition[];
  queryParams: ParamDefinition[];
  headers: HeaderDefinition[];
  requestBody?: RequestBodyDefinition;
  responseBody?: ResponseBodyDefinition;
  notes?: string;
  devComment?: string;  // developer feedback on AI output — included in next AI analysis for regression
  linkedScreenIds: string[];
  confidence?: ConfidenceInfo;
  isAiGenerated: boolean;
}

export interface ScreenRelation {
  type: "popup_on" | "opens_page" | "linked_to";
  targetScreenId: string;
}

export interface Annotation {
  id: string;
  screenId: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  number: number;
  endpointId?: string;
  label?: string;
  comment?: string;          // longer comment / context
  kind?: "point" | "rect";  // defaults to "point" when absent
  width?: number;            // percentage 0-100 (rect only)
  height?: number;           // percentage 0-100 (rect only)
  screenRelation?: ScreenRelation; // e.g. "this popup belongs to page X" or "this button opens page Y"
}

export interface Screen {
  id: string;
  name: string;
  dataUrl: string; // compressed base64
  annotationIds: string[];
  notes?: string;  // per-screen freetext context for AI
}

export interface GeneratedType {
  id: string;
  name: string;
  code: string;
  linkedEndpointIds: string[];
  isEdited: boolean;
}

export interface GeneratedSchema {
  id: string;
  name: string;
  code: string;
  linkedTypeId?: string;
  isEdited: boolean;
}

export interface ContractStack {
  backend: string;
  framework: string;
  database: string;
  frontend: string;
  auth: string;
}

export interface Contract {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  jiraStories: import("./jira").JiraStory[];
  stack?: ContractStack;
  screens: Screen[];
  annotations: Annotation[];
  endpoints: Endpoint[];
  generatedTypes: GeneratedType[];
  generatedSchemas: GeneratedSchema[];
  aiInstructions?: string; // custom user instructions included in every AI analysis
}

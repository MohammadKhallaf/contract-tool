export function buildSpecAnalysisPrompt(specSummary: string): string {
  return `You are analyzing an OpenAPI/Swagger spec to extract its conventions for use in an API contract tool.

Spec summary:
${specSummary}

Analyze the spec and respond ONLY with valid JSON in this exact shape:
{
  "paginationShape": {
    "found": true,
    "fields": ["data", "total", "offset", "itemsPerPage"],
    "description": "Human-readable description of the pagination envelope"
  },
  "errorShape": {
    "found": true,
    "fields": ["message", "code"],
    "description": "Human-readable description of the error response shape"
  },
  "namingConventions": {
    "pathPrefix": "/api",
    "paramStyle": "camelCase",
    "notes": "Any notable naming conventions"
  },
  "summary": "1-2 sentence summary of this API's conventions"
}

If pagination or error shapes are not detected, set found: false and leave fields as [].`;
}

export function buildScreenDescriptionPrompt(): string {
  return `You are analyzing UI screens for an API contract generator.
For each screen image provided, describe:
1. What UI elements are visible (forms, buttons, lists, cards, modals)
2. What data is displayed or collected (field names, data types)
3. What user actions are possible (submit, search, delete, navigate)
4. Any visible API hints (URLs in network tab, loading states, error messages)

Be specific about field names and data structures. Output plain text, one section per screen.`;
}

export function buildAnalysisPrompt(
  jiraStory: string,
  existingPatterns: string,
  screenContext?: string,
  stackContext?: string,
  typesContext?: string,
  devFeedback?: string,
  patternsContext?: string,
  customInstructions?: string
): string {
  return `You are an API contract generator. Analyze the JIRA story below and suggest API endpoints needed.

Use these existing API patterns for naming consistency:
${existingPatterns || "No existing patterns provided."}
${stackContext ? `\nTech Stack:\n${stackContext}\n` : ""}${patternsContext ? `\nReusable patterns to follow (selected by developer):\n${patternsContext}\n` : ""}
Schema rules (strictly follow these):
- ALL field details belong in the schema string — never defer field information to the notes field
- Schema values are TypeScript-style inline object literals: "{ field: type, field2?: type }"
- Use camelCase for all property names, PascalCase for type names
- Mark optional fields with "?" — only omit "?" for fields guaranteed present in every response
- Nullable fields: "deletedAt?: string | null"
- Date/time fields: always add an inline comment indicating the format — use "string /* ISO 8601 */" for ISO date strings or "number /* unix timestamp ms */" for timestamps. Examples:
  "createdAt: string /* ISO 8601 */", "updatedAt?: string /* ISO 8601 */ | null", "expiresAt: number /* unix timestamp ms */"
- Enum fields: write the exact allowed values pipe-separated as the type. NEVER use plain "string" when a finite set of values is known or can be reasonably inferred. Multi-word values are allowed. Examples:
  "status: active | inactive | pending", "stage: in_progress | under_review | completed", "role: team lead | admin | viewer"
- Common fields that MUST be enums (infer reasonable values from context):
  sortOrder → "sortOrder?: asc | desc", sortBy → list the sortable field names e.g. "sortBy?: createdAt | name | updatedAt",
  status/state → list all known states, type/kind/category → list all known variants
- Nested objects: inline up to 2 levels deep:
  "address: { street: string, city: string, zip: string }", "config: { smtp: { host: string, port: number }, enabled: boolean }"
- Array fields: "tags: string[]" or for object arrays inline the item shape: "items: { id: string, name: string }[]"
- For paginated endpoints set isPaginated: true and write the full envelope with all item fields inlined inside data:
  "schema": "{ data: { id: string, name: string, status: active | inactive }[], total: number, offset: number, itemsPerPage: number }"
- For request bodies inline all fields: "{ name: string, type?: draft | published, targetLeads?: number }"
- NEVER use a bare type name as a schema (never write "schema": "CampaignResponse")
- NEVER leave schema as just "{ success: boolean }" when the story implies a richer shape — infer all likely fields
- notes is free-form context only: business rules, edge cases, auth notes. Do NOT list field names or types in notes.
  Good: "Requires admin role. Returns 404 if campaign archived."
  Bad: "id (string), name (string), status (active | inactive)" — this belongs in the schema

${customInstructions ? `\nCustom Instructions (from developer — follow these strictly):\n${customInstructions}\n` : ""}
JIRA Story:
${jiraStory}
${screenContext ? `\nScreen Annotations & Notes:\n${screenContext}\n` : ""}${typesContext ? `\n${typesContext}\n` : ""}${devFeedback ? `\nDeveloper Feedback on Previous Output (address these issues):\n${devFeedback}\n` : ""}
Respond ONLY with valid JSON in this exact shape:
{
  "endpoints": [
    {
      "method": "GET|POST|PUT|PATCH|DELETE",
      "path": "/api/resource/{id}",
      "description": "What this endpoint does",
      "pathParams": [{ "name": "id", "type": "string", "required": true }],
      "queryParams": [{ "name": "sortOrder", "type": "asc | desc", "required": false }, { "name": "status", "type": "active | inactive | pending", "required": false }],
      "headers": [{ "name": "Authorization", "value": "Bearer <token>", "required": true }],
      "requestBody": { "contentType": "application/json", "schema": "{ name: string, status: draft | published }" },
      "responseBody": { "statusCode": 200, "schema": "{ id: string, name: string, status: active | inactive, createdAt: string }", "isPaginated": false },
      "notes": "Optional business context only — no field listings"
    }
  ],
  "reasoning": "Brief explanation of why these endpoints were chosen"
}`;
}

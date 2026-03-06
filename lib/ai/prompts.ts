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
  patternsContext?: string
): string {
  return `You are an API contract generator. Analyze the JIRA story below and suggest API endpoints needed.

Use these existing API patterns for naming consistency:
${existingPatterns || "No existing patterns provided."}
${stackContext ? `\nTech Stack:\n${stackContext}\n` : ""}${patternsContext ? `\nReusable patterns to follow (selected by developer):\n${patternsContext}\n` : ""}
OpenAPI & TypeScript Best Practices (always follow these):
- Use PascalCase for all schema/type names (e.g. CreateUserRequest, UserResponse)
- Use camelCase for all property names
- Separate request and response schemas — never reuse the same schema for both
- Mark a property as required only if it is always present in every response/request
- If a field can be null, note it as nullable (e.g. "deletedAt": "string | null")
- For string enum fields, list the allowed values inline (e.g. "status": "active | inactive | pending")
- For paginated endpoints, always set isPaginated: true and shape the response as { data: T[], total: number, offset: number, itemsPerPage: number }
- Use clear operationId-style descriptions: verb + noun in camelCase (e.g. "getUser", "createInvoice", "listOrders")
- Prefer explicit field names over generic shapes; avoid additionalProperties
- For error responses, use the shape: { message: string, code: string }

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
      "queryParams": [],
      "requestBody": { "contentType": "application/json", "schema": "{ id: string }" },
      "responseBody": { "statusCode": 200, "schema": "{ success: boolean }", "isPaginated": false },
      "notes": "Any important notes"
    }
  ],
  "reasoning": "Brief explanation of why these endpoints were chosen"
}`;
}

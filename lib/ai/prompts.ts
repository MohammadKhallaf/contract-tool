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
  screenContext?: string
): string {
  return `You are an API contract generator. Analyze the JIRA story below and suggest API endpoints needed.

Use these existing API patterns for naming consistency:
${existingPatterns || "No existing patterns provided."}

JIRA Story:
${jiraStory}
${screenContext ? `\nScreen Annotations & Notes:\n${screenContext}\n` : ""}
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

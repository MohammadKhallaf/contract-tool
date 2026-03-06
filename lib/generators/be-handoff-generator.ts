import type { Contract } from "@/types";
import { getLinkedScreenNames, buildScreenEndpointMap } from "@/lib/utils/screen-links";

export function generateBeHandoff(contract: Contract): string {
  const sections: string[] = [];

  const storyKeys = contract.jiraStories
    .map((s) => s.key)
    .filter(Boolean)
    .join(", ");

  sections.push(`# BE Handoff: ${contract.name}`);
  sections.push(
    `> Generated: ${new Date().toLocaleString()} | Stories: ${storyKeys || "none"}`
  );
  sections.push("");

  // Tech Stack
  if (contract.stack) {
    const s = contract.stack;
    sections.push("## Tech Stack");
    sections.push("");
    sections.push("| Layer | Technology |");
    sections.push("|-------|------------|");
    sections.push(`| Backend | ${s.backend || "—"} |`);
    sections.push(`| Framework | ${s.framework || "—"} |`);
    sections.push(`| Database | ${s.database || "—"} |`);
    sections.push(`| Frontend | ${s.frontend || "—"} |`);
    sections.push(`| Auth | ${s.auth || "—"} |`);
    sections.push("");
  }

  // JIRA Stories
  if (contract.jiraStories.length > 0) {
    sections.push("## JIRA Stories");
    sections.push("");
    contract.jiraStories.forEach((story) => {
      const heading = story.key
        ? `### ${story.key}: ${story.title}`
        : `### ${story.title}`;
      sections.push(heading);
      if (story.description) {
        sections.push(`**Description:** ${story.description}`);
      }
      if (story.acceptanceCriteria.length > 0) {
        sections.push("**Acceptance Criteria:**");
        story.acceptanceCriteria.forEach((ac) => {
          sections.push(`- [ ] ${ac.text}`);
        });
      }
      sections.push("");
    });
  }

  // API Endpoints
  const enabledEndpoints = contract.endpoints.filter((ep) => ep.enabled);
  if (enabledEndpoints.length > 0) {
    sections.push("## API Endpoints");
    sections.push("");
    for (const ep of enabledEndpoints) {
      sections.push(`### \`${ep.method} ${ep.path}\``);
      if (ep.description) sections.push(`**Description:** ${ep.description}`);
      sections.push("");

      if (ep.pathParams.length > 0) {
        sections.push("**Path Parameters:**");
        sections.push("| Name | Type | Required | Description |");
        sections.push("|------|------|----------|-------------|");
        ep.pathParams.forEach((p) => {
          sections.push(
            `| \`${p.name}\` | ${p.type} | ${p.required ? "Yes" : "No"} | ${p.description ?? ""} |`
          );
        });
        sections.push("");
      }

      if (ep.queryParams.length > 0) {
        sections.push("**Query Parameters:**");
        sections.push("| Name | Type | Required | Description |");
        sections.push("|------|------|----------|-------------|");
        ep.queryParams.forEach((p) => {
          sections.push(
            `| \`${p.name}\` | ${p.type} | ${p.required ? "Yes" : "No"} | ${p.description ?? ""} |`
          );
        });
        sections.push("");
      }

      if (ep.requestBody) {
        sections.push("**Request Body:**");
        sections.push("```json");
        sections.push(ep.requestBody.schema || "{}");
        sections.push("```");
        sections.push("");
      }

      if (ep.responseBody) {
        sections.push(`**Response (${ep.responseBody.statusCode}):**`);
        if (ep.responseBody.isPaginated) sections.push("_Paginated response_");
        sections.push("```json");
        sections.push(ep.responseBody.schema || "{}");
        sections.push("```");
        sections.push("");
      }

      const pageNames = getLinkedScreenNames(ep, contract.annotations, contract.screens);
      if (pageNames.length > 0) {
        sections.push(`**Used on pages:** ${pageNames.join(", ")}`);
        sections.push("");
      }

      if (ep.notes) {
        sections.push(`**Notes:** ${ep.notes}`);
        sections.push("");
      }
    }
  }

  // Page → Endpoint Map
  if (contract.screens.length > 0 && enabledEndpoints.length > 0) {
    const screenEpMap = buildScreenEndpointMap(enabledEndpoints, contract.annotations);
    const hasLinks = [...screenEpMap.values()].some((eps) => eps.length > 0);
    if (hasLinks) {
      sections.push("## Page → Endpoint Map");
      sections.push("");
      for (const screen of contract.screens) {
        const eps = screenEpMap.get(screen.id);
        if (!eps || eps.length === 0) continue;
        sections.push(`### ${screen.name}`);
        for (const ep of eps) {
          sections.push(`- \`${ep.method} ${ep.path}\` — ${ep.description}`);
        }
        sections.push("");
      }
    }
  }

  // TypeScript Types (Reference)
  if (contract.generatedTypes.length > 0) {
    sections.push("## TypeScript Types (Reference)");
    sections.push("");
    sections.push("```typescript");
    contract.generatedTypes.forEach((t) => {
      sections.push(t.code);
      sections.push("");
    });
    sections.push("```");
    sections.push("");
  }

  return sections.join("\n");
}

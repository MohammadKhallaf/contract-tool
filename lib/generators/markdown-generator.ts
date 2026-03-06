import type { Contract } from "@/types";
import { getLinkedScreenNames, buildScreenEndpointMap } from "@/lib/utils/screen-links";

export function generateMarkdown(contract: Contract): string {
  const sections: string[] = [];

  sections.push(`# API Contract: ${contract.name}`);
  sections.push(`> Generated: ${new Date(contract.updatedAt).toLocaleString()}`);
  sections.push("");

  // JIRA Stories
  if (contract.jiraStories.length > 0) {
    sections.push("## JIRA Stories");
    sections.push("");
    contract.jiraStories.forEach((story, idx) => {
      const heading = story.key
        ? `### Story ${idx + 1}: ${story.key} — ${story.title}`
        : `### Story ${idx + 1}: ${story.title}`;
      sections.push(heading);
      if (story.storyPoints !== undefined)
        sections.push(`**Story Points:** ${story.storyPoints}`);
      if (story.priority) sections.push(`**Priority:** ${story.priority}`);
      if (story.labels.length > 0)
        sections.push(`**Labels:** ${story.labels.join(", ")}`);
      if (story.description) {
        sections.push("", "**Description:**", story.description);
      }
      if (story.acceptanceCriteria.length > 0) {
        sections.push("", "**Acceptance Criteria:**");
        story.acceptanceCriteria.forEach((ac, i) => {
          sections.push(`${i + 1}. ${ac.text}`);
        });
      }
      sections.push("");
    });
  }

  // Endpoints table
  const enabledEndpoints = contract.endpoints.filter((ep) => ep.enabled);
  if (enabledEndpoints.length > 0) {
    sections.push("## Endpoints");
    sections.push("");
    sections.push("| Method | Path | Description | Confidence |");
    sections.push("|--------|------|-------------|------------|");
    for (const ep of enabledEndpoints) {
      const conf = ep.confidence?.level ?? "—";
      sections.push(
        `| \`${ep.method}\` | \`${ep.path}\` | ${ep.description} | ${conf} |`
      );
    }
    sections.push("");

    // Endpoint details
    sections.push("## Endpoint Details");
    for (const ep of enabledEndpoints) {
      sections.push(`### \`${ep.method} ${ep.path}\``);
      sections.push(ep.description);
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
        sections.push(`- Content-Type: \`${ep.requestBody.contentType}\``);
        sections.push("```");
        sections.push(ep.requestBody.schema ?? "{}");
        sections.push("```");
        sections.push("");
      }

      if (ep.responseBody) {
        sections.push("**Response:**");
        sections.push(`- Status: \`${ep.responseBody.statusCode}\``);
        if (ep.responseBody.isPaginated) sections.push("- Paginated: Yes");
        sections.push("```");
        sections.push(ep.responseBody.schema ?? "{}");
        sections.push("```");
        sections.push("");
      }

      const pageNames = getLinkedScreenNames(ep, contract.annotations, contract.screens);
      if (pageNames.length > 0) {
        sections.push(`**Used on pages:** ${pageNames.join(", ")}`);
        sections.push("");
      }

      if (ep.notes) {
        sections.push("**Notes:**");
        sections.push(ep.notes);
        sections.push("");
      }
    }
  }

  // TypeScript Types
  if (contract.generatedTypes.length > 0) {
    sections.push("## TypeScript Types");
    sections.push("");
    sections.push("```typescript");
    contract.generatedTypes.forEach((t) => {
      sections.push(t.code);
      sections.push("");
    });
    sections.push("```");
    sections.push("");
  }

  // Yup Schemas
  if (contract.generatedSchemas.length > 0) {
    sections.push("## Yup Schemas");
    sections.push("");
    sections.push("```typescript");
    sections.push("import * as yup from 'yup';");
    sections.push("");
    contract.generatedSchemas.forEach((s) => {
      sections.push(s.code);
      sections.push("");
    });
    sections.push("```");
    sections.push("");
  }

  // Screen annotation legends
  if (contract.screens.length > 0) {
    sections.push("## Screen Annotations");
    for (const screen of contract.screens) {
      const anns = contract.annotations.filter(
        (a) => a.screenId === screen.id
      );
      if (anns.length === 0) continue;
      sections.push(`### ${screen.name}`);
      sections.push("| Marker | Endpoint |");
      sections.push("|--------|----------|");
      for (const ann of anns) {
        const ep = ann.endpointId
          ? contract.endpoints.find((e) => e.id === ann.endpointId)
          : null;
        const endpointStr = ep
          ? `\`${ep.method} ${ep.path}\``
          : ann.label ?? "Unlinked";
        sections.push(`| #${ann.number} | ${endpointStr} |`);
      }
      sections.push("");
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

  return sections.join("\n");
}

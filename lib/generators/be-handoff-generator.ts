import type { Contract } from "@/types";
import { getLinkedScreenNames, buildScreenEndpointMap } from "@/lib/utils/screen-links";

function schemaFence(schema: string | undefined): string {
  const body = schema?.trim() || "{}";
  return `\`\`\`jsonc\n${body}\n\`\`\``;
}

export function generateBeHandoff(contract: Contract): string {
  const sections: string[] = [];

  const enabledEndpoints = contract.endpoints.filter((ep) => ep.enabled);
  const storyKeys = contract.jiraStories
    .map((s) => s.key)
    .filter(Boolean);
  const generatedAt = new Date().toISOString();

  // Frontmatter
  sections.push("---");
  sections.push(`title: ${contract.name}`);
  sections.push(`generatedAt: ${generatedAt}`);
  sections.push(`storyKeys: [${storyKeys.map((k) => `"${k}"`).join(", ")}]`);
  sections.push(`endpointCount: ${enabledEndpoints.length}`);
  sections.push("---");
  sections.push("");

  // H1 + stories line
  sections.push(`# BE Handoff: ${contract.name}`);
  sections.push("");
  if (storyKeys.length > 0) {
    sections.push(`**Stories:** ${storyKeys.join(", ")}`);
    sections.push("");
  }

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

  // API Endpoints
  sections.push("## API Endpoints");
  sections.push("");
  for (const ep of enabledEndpoints) {
    sections.push(`### \`${ep.method} ${ep.path}\``);
    sections.push("");
    sections.push(`> ${ep.description}`);
    sections.push("");

    // Headers
    if (ep.headers.length > 0) {
      sections.push("**Headers:**");
      sections.push("| Name | Value | Required |");
      sections.push("|------|-------|----------|");
      ep.headers.forEach((h) => {
        sections.push(
          `| ${h.name} | ${h.value} | ${h.required ? "Yes" : "No"} |`
        );
      });
    } else {
      sections.push("**Headers:** None");
    }
    sections.push("");

    // Path Parameters
    if (ep.pathParams.length > 0) {
      sections.push("**Path Parameters:**");
      sections.push("| Name | Type | Required | Description |");
      sections.push("|------|------|----------|-------------|");
      ep.pathParams.forEach((p) => {
        sections.push(
          `| \`${p.name}\` | ${p.type} | ${p.required ? "Yes" : "No"} | ${p.description ?? ""} |`
        );
      });
    } else {
      sections.push("**Path Parameters:** None");
    }
    sections.push("");

    // Query Parameters
    if (ep.queryParams.length > 0) {
      sections.push("**Query Parameters:**");
      sections.push("| Name | Type | Required | Description |");
      sections.push("|------|------|----------|-------------|");
      ep.queryParams.forEach((p) => {
        sections.push(
          `| \`${p.name}\` | ${p.type} | ${p.required ? "Yes" : "No"} | ${p.description ?? ""} |`
        );
      });
    } else {
      sections.push("**Query Parameters:** None");
    }
    sections.push("");

    // Request Body
    if (ep.requestBody) {
      sections.push(`**Request Body:** \`${ep.requestBody.contentType}\``);
      sections.push(schemaFence(ep.requestBody.schema));
    } else {
      sections.push("**Request Body:** None");
    }
    sections.push("");

    // Response
    if (ep.responseBody) {
      const paginatedSuffix = ep.responseBody.isPaginated ? " [Paginated]" : "";
      sections.push(`**Response:** \`${ep.responseBody.statusCode}\`${paginatedSuffix}`);
      sections.push(schemaFence(ep.responseBody.schema));
    } else {
      sections.push("**Response:** None");
    }
    sections.push("");

    // Used on Pages
    const pageNames = getLinkedScreenNames(ep, contract.annotations, contract.screens);
    if (pageNames.length > 0) {
      sections.push(`**Used on Pages:** ${pageNames.join(", ")}`);
    } else {
      sections.push("**Used on Pages:** None");
    }
    sections.push("");

    // Notes
    if (ep.notes) {
      sections.push(`**Notes:** ${ep.notes}`);
    } else {
      sections.push("**Notes:** None");
    }
    sections.push("");

    sections.push("---");
    sections.push("");
  }
  if (enabledEndpoints.length === 0) {
    sections.push("_No endpoints._");
    sections.push("");
  }

  // Page → Endpoint Map
  sections.push("## Page → Endpoint Map");
  sections.push("");
  if (contract.screens.length > 0 && enabledEndpoints.length > 0) {
    const screenEpMap = buildScreenEndpointMap(enabledEndpoints, contract.annotations);
    const hasLinks = [...screenEpMap.values()].some((eps) => eps.length > 0);
    if (hasLinks) {
      for (const screen of contract.screens) {
        const eps = screenEpMap.get(screen.id);
        if (!eps || eps.length === 0) continue;
        sections.push(`### ${screen.name}`);
        for (const ep of eps) {
          sections.push(`- \`${ep.method} ${ep.path}\` — ${ep.description}`);
        }
        sections.push("");
      }
    } else {
      sections.push("_No page-to-endpoint links._");
      sections.push("");
    }
  } else {
    sections.push("_No pages or endpoints._");
    sections.push("");
  }

  return sections.join("\n");
}

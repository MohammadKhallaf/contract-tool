import type { Contract } from "@/types";
import { getLinkedScreenNames, buildScreenEndpointMap } from "@/lib/utils/screen-links";

function schemaFence(schema: string | undefined): string {
  const body = schema?.trim() || "{}";
  return `\`\`\`jsonc\n${body}\n\`\`\``;
}

export function generateMarkdown(contract: Contract): string {
  const sections: string[] = [];

  const enabledEndpoints = contract.endpoints.filter((ep) => ep.enabled);
  const storyKeys = contract.jiraStories
    .map((s) => s.key)
    .filter(Boolean);
  const generatedAt = new Date(contract.updatedAt).toISOString();

  // Frontmatter
  sections.push("---");
  sections.push(`title: ${contract.name}`);
  sections.push(`generatedAt: ${generatedAt}`);
  sections.push(`storyKeys: [${storyKeys.map((k) => `"${k}"`).join(", ")}]`);
  sections.push(`endpointCount: ${enabledEndpoints.length}`);
  sections.push("---");
  sections.push("");

  // H1 + stories line
  sections.push(`# API Contract: ${contract.name}`);
  sections.push("");
  if (storyKeys.length > 0) {
    sections.push(`**Stories:** ${storyKeys.join(", ")}`);
    sections.push("");
  }

  // Table of Contents
  sections.push("## Table of Contents");
  sections.push("- [Endpoints](#endpoints)");
  sections.push("- [Endpoint Details](#endpoint-details)");
  sections.push("- [Types & Validation](#types--validation)");
  sections.push("- [Screen Annotations](#screen-annotations)");
  sections.push("- [Page → Endpoint Map](#page--endpoint-map)");
  sections.push("");

  // Endpoints summary table
  sections.push("## Endpoints");
  sections.push("");
  if (enabledEndpoints.length > 0) {
    sections.push("| Method | Path | Description | Confidence |");
    sections.push("|--------|------|-------------|------------|");
    for (const ep of enabledEndpoints) {
      const conf = ep.confidence?.level ?? "—";
      sections.push(
        `| \`${ep.method}\` | \`${ep.path}\` | ${ep.description} | ${conf} |`
      );
    }
  } else {
    sections.push("_No endpoints._");
  }
  sections.push("");

  // Endpoint Details
  sections.push("## Endpoint Details");
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
      sections.push(`**Response:** \`${ep.responseBody.statusCode}\``);
      sections.push(schemaFence(ep.responseBody.schema));
      if (ep.responseBody.isPaginated) {
        sections.push("");
        sections.push("_Paginated:_ Yes");
      }
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

  // Types & Validation (paired interface + yup schema)
  sections.push("## Types & Validation");
  sections.push("");
  if (contract.generatedTypes.length > 0 || contract.generatedSchemas.length > 0) {
    const pairedSchemaIds = new Set<string>();

    for (const type of contract.generatedTypes) {
      sections.push(`### \`${type.name}\``);
      sections.push("");
      sections.push("```typescript");
      sections.push(type.code);
      sections.push("```");
      sections.push("");

      // Paired yup schema
      const paired = contract.generatedSchemas.find((s) => s.linkedTypeId === type.id);
      if (paired) {
        pairedSchemaIds.add(paired.id);
        sections.push("```typescript");
        sections.push("// Yup validation");
        sections.push(paired.code);
        sections.push("```");
        sections.push("");
      }
    }

    // Orphan yup schemas (no linked type)
    const orphans = contract.generatedSchemas.filter((s) => !pairedSchemaIds.has(s.id));
    if (orphans.length > 0) {
      sections.push("### Validation Schemas");
      sections.push("");
      sections.push("```typescript");
      sections.push("// Yup validation");
      orphans.forEach((s) => {
        sections.push(s.code);
        sections.push("");
      });
      sections.push("```");
      sections.push("");
    }
  } else {
    sections.push("_No types or validation schemas._");
    sections.push("");
  }

  // Screen Annotations
  sections.push("## Screen Annotations");
  sections.push("");
  if (contract.screens.length > 0) {
    let hasAnnotations = false;
    for (const screen of contract.screens) {
      const anns = contract.annotations.filter((a) => a.screenId === screen.id);
      if (anns.length === 0) continue;
      hasAnnotations = true;
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
    if (!hasAnnotations) {
      sections.push("_No screen annotations._");
      sections.push("");
    }
  } else {
    sections.push("_No screens._");
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

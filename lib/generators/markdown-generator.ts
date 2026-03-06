import type { Contract, Endpoint } from "@/types";
import { getLinkedScreenNames, buildScreenEndpointMap } from "@/lib/utils/screen-links";
import { extractDataItemShape, parseTsObjectLiteral } from "./schema-utils";

/** Escape pipe characters inside markdown table cells */
function escPipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}

function schemaFence(schema: string | undefined): string {
  const body = schema?.trim() || "{}";
  return `\`\`\`jsonc\n${body}\n\`\`\``;
}

/** Render the response section for an endpoint in a structured way */
function renderResponseSection(ep: Endpoint): string[] {
  const lines: string[] = [];
  if (!ep.responseBody) {
    lines.push("**Response:** None");
    return lines;
  }

  const rawSchema = ep.responseBody.schema ?? "";
  const paginated = ep.responseBody.isPaginated;
  const statusCode = ep.responseBody.statusCode;

  if (paginated) {
    const dataShape = extractDataItemShape(rawSchema);
    lines.push(`**Response:** \`${statusCode}\` *(Paginated)*`);
    lines.push("");
    lines.push("| Field | Type |");
    lines.push("|-------|------|");
    if (dataShape?.isInline) {
      lines.push(`| \`data\` | \`object[]\` — see item fields below |`);
    } else if (dataShape && !dataShape.isInline) {
      lines.push(`| \`data\` | \`${dataShape.namedType}[]\` |`);
    } else {
      lines.push("| `data` | `object[]` |");
    }
    lines.push("| `total` | `number` |");
    lines.push("| `offset` | `number` |");
    lines.push("| `itemsPerPage` | `number` |");
    if (dataShape?.isInline) {
      // Try to render as a field table; fall back to jsonc fence
      const itemFields = parseTsObjectLiteral(dataShape.itemShape);
      if (itemFields.length > 0) {
        lines.push("");
        lines.push("**Item fields:**");
        lines.push("");
        lines.push("| Field | Type | Required |");
        lines.push("|-------|------|----------|");
        for (const f of itemFields) {
          lines.push(`| \`${f.name}\` | \`${escPipe(f.type)}\` | ${f.required ? "Yes" : "No"} |`);
        }
      } else {
        lines.push("");
        lines.push("**Item fields:**");
        lines.push(schemaFence(dataShape.itemShape));
      }
    }
  } else if (rawSchema && !rawSchema.trim().startsWith("{")) {
    lines.push(`**Response:** \`${statusCode}\``);
    lines.push("");
    lines.push(`> Type: \`${rawSchema.trim()}\``);
  } else {
    lines.push(`**Response:** \`${statusCode}\``);
    lines.push("");
    lines.push(schemaFence(rawSchema));
  }

  return lines;
}

/** Parse notes and render "TypeName includes: ..." patterns as field tables */
function renderNotes(notes: string | undefined): string[] {
  if (!notes) return ["**Notes:** None"];

  const lines: string[] = [];

  const includesPattern = /(\w+)\s+includes?:\s*([^.]+(?:\.[^.]+)*?)(?=\s+\w+\s+includes?:|$)/gi;
  const fieldBlocks: { typeName: string; raw: string }[] = [];
  let plainNotes = notes;

  let m: RegExpExecArray | null;
  while ((m = includesPattern.exec(notes)) !== null) {
    fieldBlocks.push({ typeName: m[1], raw: m[2].trim() });
    plainNotes = plainNotes.replace(m[0], "").trim();
  }

  const plain = plainNotes.trim();
  if (plain) {
    lines.push(`**Notes:** ${plain}`);
  } else if (fieldBlocks.length > 0) {
    lines.push("**Notes:**");
  } else {
    lines.push("**Notes:** None");
    return lines;
  }

  for (const block of fieldBlocks) {
    lines.push("");
    lines.push(`**\`${block.typeName}\` fields:**`);
    lines.push("");
    lines.push("| Field | Type | Notes |");
    lines.push("|-------|------|-------|");

    // Depth-aware split on commas outside parentheses
    const tokens: string[] = [];
    let cur = "", depth = 0;
    for (const ch of block.raw) {
      if (ch === "(" ) depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) { if (cur.trim()) tokens.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) tokens.push(cur.trim());

    tokens.forEach((token) => {
      // "fieldName (type: description)" — e.g. status (string: active | completed | in progress)
      const withTypeAndDesc = token.match(/^(\w+)\s+\(([^:)]+):\s*(.+)\)$/);
      // "fieldName (type)" — e.g. name (string)
      const withType = token.match(/^(\w+)\s+\(([^)]+)\)$/);
      if (withTypeAndDesc) {
        const [, name, type, desc] = withTypeAndDesc;
        lines.push(`| \`${name}\` | \`${escPipe(type.trim())}\` | ${escPipe(desc.trim())} |`);
      } else if (withType) {
        const [, name, type] = withType;
        lines.push(`| \`${name}\` | \`${escPipe(type.trim())}\` | — |`);
      } else {
        lines.push(`| \`${token}\` | — | — |`);
      }
    });
  }

  return lines;
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
          `| \`${p.name}\` | ${escPipe(p.type)} | ${p.required ? "Yes" : "No"} | ${escPipe(p.description ?? "")} |`
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
          `| \`${p.name}\` | ${escPipe(p.type)} | ${p.required ? "Yes" : "No"} | ${escPipe(p.description ?? "")} |`
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
    renderResponseSection(ep).forEach((line) => sections.push(line));
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
    renderNotes(ep.notes).forEach((line) => sections.push(line));
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

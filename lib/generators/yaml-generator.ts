import type { Contract } from "@/types";

function toYamlValue(value: unknown, indent = 0): string {
  const pad = " ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value.includes("\n") || value.includes(":") || value.includes("#") || value.startsWith(" ")) {
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    return value || '""';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "\n" + value.map((v) => `${pad}- ${toYamlValue(v, indent + 2)}`).join("\n");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== undefined && v !== null
    );
    if (entries.length === 0) return "{}";
    return (
      "\n" +
      entries
        .map(([k, v]) => {
          const rendered = toYamlValue(v, indent + 2);
          const isBlock = rendered.startsWith("\n");
          return `${pad}${k}:${isBlock ? rendered : " " + rendered}`;
        })
        .join("\n")
    );
  }
  return String(value);
}

function renderYamlObject(obj: Record<string, unknown>, indent = 0): string {
  const pad = " ".repeat(indent);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const rendered = toYamlValue(v, indent + 2);
    const isBlock = rendered.startsWith("\n");
    lines.push(`${pad}${k}:${isBlock ? rendered : " " + rendered}`);
  }
  return lines.join("\n");
}

export function generateYaml(contract: Contract): string {
  const enabledEndpoints = contract.endpoints.filter((ep) => ep.enabled);
  const lines: string[] = [];

  lines.push(`name: "${contract.name}"`);
  lines.push(`generated: "${new Date(contract.updatedAt).toISOString()}"`);

  if (contract.jiraStories.length > 0) {
    lines.push("jira_stories:");
    contract.jiraStories.forEach((s) => {
      lines.push(`  - title: "${s.title.replace(/"/g, '\\"')}"`);
      if (s.key) lines.push(`    key: "${s.key}"`);
      if (s.storyPoints !== undefined) lines.push(`    story_points: ${s.storyPoints}`);
      if (s.priority) lines.push(`    priority: "${s.priority}"`);
      if (s.labels.length > 0) lines.push(`    labels: [${s.labels.map((l) => `"${l}"`).join(", ")}]`);
      if (s.description) {
        lines.push(`    description: |`);
        s.description.split("\n").forEach((l) => lines.push(`      ${l}`));
      }
      if (s.acceptanceCriteria.length > 0) {
        lines.push("    acceptance_criteria:");
        s.acceptanceCriteria.forEach((ac) => {
          lines.push(`      - text: "${ac.text.replace(/"/g, '\\"')}"`);
        });
      }
    });
  }

  if (enabledEndpoints.length > 0) {
    lines.push("endpoints:");
    for (const ep of enabledEndpoints) {
      lines.push(`  - method: ${ep.method}`);
      lines.push(`    path: "${ep.path}"`);
      lines.push(`    description: "${ep.description.replace(/"/g, '\\"')}"`);
      if (ep.confidence?.level) lines.push(`    confidence: ${ep.confidence.level}`);

      if (ep.pathParams.length > 0) {
        lines.push("    path_params:");
        ep.pathParams.forEach((p) => {
          lines.push(`      - name: ${p.name}`);
          lines.push(`        type: ${p.type}`);
          lines.push(`        required: ${p.required}`);
          if (p.description) lines.push(`        description: "${p.description}"`);
        });
      }

      if (ep.queryParams.length > 0) {
        lines.push("    query_params:");
        ep.queryParams.forEach((p) => {
          lines.push(`      - name: ${p.name}`);
          lines.push(`        type: ${p.type}`);
          lines.push(`        required: ${p.required}`);
          if (p.description) lines.push(`        description: "${p.description}"`);
        });
      }

      if (ep.headers.length > 0) {
        lines.push("    headers:");
        ep.headers.forEach((h) => {
          lines.push(`      - name: ${h.name}`);
          lines.push(`        value: "${h.value}"`);
          lines.push(`        required: ${h.required}`);
        });
      }

      if (ep.requestBody) {
        lines.push("    request_body:");
        lines.push(`      content_type: "${ep.requestBody.contentType}"`);
        lines.push("      schema: |");
        ep.requestBody.schema.split("\n").forEach((l) => lines.push(`        ${l}`));
      }

      if (ep.responseBody) {
        lines.push("    response_body:");
        lines.push(`      status_code: ${ep.responseBody.statusCode}`);
        lines.push(`      is_paginated: ${ep.responseBody.isPaginated}`);
        lines.push("      schema: |");
        ep.responseBody.schema.split("\n").forEach((l) => lines.push(`        ${l}`));
      }

      if (ep.notes) {
        lines.push("    notes: |");
        ep.notes.split("\n").forEach((l) => lines.push(`      ${l}`));
      }
    }
  }

  if (contract.generatedTypes.length > 0) {
    lines.push("typescript_types:");
    contract.generatedTypes.forEach((t) => {
      lines.push(`  - name: ${t.name}`);
      lines.push("    code: |");
      t.code.split("\n").forEach((l) => lines.push(`      ${l}`));
    });
  }

  if (contract.generatedSchemas.length > 0) {
    lines.push("yup_schemas:");
    contract.generatedSchemas.forEach((s) => {
      lines.push(`  - name: ${s.name}`);
      lines.push("    code: |");
      s.code.split("\n").forEach((l) => lines.push(`      ${l}`));
    });
  }

  return lines.join("\n") + "\n";
}

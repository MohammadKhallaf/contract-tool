import type { JiraStory } from "@/types";

// Local type mirror — no import from work-wave
interface ImportedEpicItem {
  id: string;
  name: string;
  description?: string;
  summary?: string;
  type: string;
  status?: string;
  assignee?: string;
  children?: ImportedEpicItem[];
  parentId?: string | null;
}

function itemToStory(item: ImportedEpicItem): JiraStory {
  return {
    key: item.id,
    title: item.name,
    description: item.description ?? item.summary ?? "",
    labels: [item.type, item.status].filter((v): v is string => Boolean(v)),
    acceptanceCriteria: [],
  };
}

function flattenItems(items: ImportedEpicItem[]): JiraStory[] {
  const stories: JiraStory[] = [];
  for (const item of items) {
    stories.push(itemToStory(item));
    if (item.children && item.children.length > 0) {
      stories.push(...flattenItems(item.children));
    }
  }
  return stories;
}

/**
 * Parse exported JSON from work-wave Epic Tree Export.
 * Handles both EpicItem[] (array) and { epic: EpicItem } (EpicTree wrapper).
 */
export function parseEpicJson(json: unknown): JiraStory[] {
  if (Array.isArray(json)) {
    return flattenItems(json as ImportedEpicItem[]);
  }

  if (json && typeof json === "object" && "epic" in json) {
    const wrapper = json as { epic: ImportedEpicItem };
    return flattenItems([wrapper.epic]);
  }

  return [];
}

/**
 * Parse exported Markdown from work-wave Epic Tree Export.
 * Parses "# Epic: ID - Name" style headings and Status/Assignee/Description fields.
 */
export function parseEpicMarkdown(text: string): JiraStory[] {
  const stories: JiraStory[] = [];
  const lines = text.split("\n");

  const headingRe = /^(#{1,4})\s+(Epic|Story|Task|Subtask):\s*(\S+)\s+-\s+(.+)$/i;

  let current: Partial<JiraStory> | null = null;
  let descLines: string[] = [];

  function flush() {
    if (current && current.title) {
      stories.push({
        key: current.key,
        title: current.title,
        // FIXED: Join all accumulated lines for the description
        description: descLines.join("\n").trim(),
        labels: current.labels ?? [],
        acceptanceCriteria: [],
      });
    }
    current = null;
    descLines = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(headingRe);
    if (headingMatch) {
      flush();
      const [, , type, id, name] = headingMatch;
      current = {
        key: id.trim(),
        title: name.trim(),
        labels: [type.toLowerCase()],
      };
      continue;
    }

    if (!current) continue;

    const statusMatch = line.match(/^Status:\s*(.+)$/i);
    if (statusMatch) {
      current.labels = [...(current.labels ?? []), statusMatch[1].trim()];
      continue;
    }

    // FIXED: Instead of setting current.description, push the text into descLines
    const descMatch = line.match(/^Description:\s*(.*)$/i);
    if (descMatch) {
      const inlineDescText = descMatch[1].trim();
      if (inlineDescText) {
        descLines.push(inlineDescText);
      }
      continue;
    }

    // Collect remaining non-empty lines as extra description context
    if (line.trim() && !line.match(/^Assignee:/i)) {
      // Optional: Strip out the triple backticks if you used the updated exporter from earlier
      const cleanLine = line.replace(/^```$/, "").trim();
      if (cleanLine) {
        descLines.push(cleanLine);
      }
    }
  }

  flush();
  return stories;
}
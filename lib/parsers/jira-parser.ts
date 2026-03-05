import type { JiraStory, AcceptanceCriteria } from "@/types";

export function parseJiraText(raw: string): JiraStory {
  const lines = raw.split("\n").map((l) => l.trim());

  // Extract key like DBC-123
  const keyMatch = raw.match(/\b([A-Z]+-\d+)\b/);
  const key = keyMatch?.[1];

  // Title: first non-empty line or line after "Summary:" / "Title:"
  let title = "";
  const titleLine = lines.find((l) =>
    /^(summary|title|story)\s*:/i.test(l)
  );
  if (titleLine) {
    title = titleLine.replace(/^(summary|title|story)\s*:/i, "").trim();
  } else {
    title = lines.find((l) => l.length > 0 && !l.startsWith("*") && !l.startsWith("-")) ?? "";
  }

  // Story points
  const spMatch = raw.match(/story\s*points?\s*[:\-]?\s*(\d+)/i);
  const storyPoints = spMatch ? parseInt(spMatch[1], 10) : undefined;

  // Labels
  const labelsMatch = raw.match(/labels?\s*[:\-]?\s*([^\n]+)/i);
  const labels = labelsMatch
    ? labelsMatch[1].split(/[,;]/).map((l) => l.trim()).filter(Boolean)
    : [];

  // Priority
  const priorityMatch = raw.match(/priority\s*[:\-]?\s*(\w+)/i);
  const priority = priorityMatch?.[1];

  // Acceptance criteria — lines starting with AC:, Given/When/Then, numbered, or after "Acceptance Criteria:"
  const acLines: string[] = [];
  let inAC = false;
  for (const line of lines) {
    if (/acceptance criteria/i.test(line)) {
      inAC = true;
      continue;
    }
    if (inAC) {
      if (line === "" && acLines.length > 0) {
        // blank line may end AC block if next section starts
        continue;
      }
      if (/^(description|labels?|priority|story points?|notes?)\s*:/i.test(line)) {
        inAC = false;
        continue;
      }
      if (line.match(/^[-*\d.]+\s+.+/) || line.match(/^(given|when|then|and)\b/i)) {
        acLines.push(line.replace(/^[-*\d.]+\s*/, "").trim());
      }
    }
  }

  const acceptanceCriteria: AcceptanceCriteria[] = acLines.map((text, i) => ({
    id: String(i),
    text,
    checked: false,
  }));

  // Description: everything between title and AC (rough)
  const descMatch = raw.match(/description\s*[:\-]?\s*([\s\S]*?)(?=acceptance criteria|labels?|priority|story points?|$)/i);
  const description = descMatch
    ? descMatch[1].trim()
    : lines.slice(1, 5).join(" ").trim();

  return {
    key,
    title: title || "Untitled Story",
    description,
    acceptanceCriteria,
    storyPoints,
    labels,
    priority,
    rawText: raw,
  };
}

export function serializeJiraStory(story: JiraStory): string {
  const lines: string[] = [];
  if (story.key) lines.push(`${story.key} - ${story.title}`);
  else lines.push(story.title);

  if (story.description) {
    lines.push("", "Description:", story.description);
  }

  if (story.acceptanceCriteria.length > 0) {
    lines.push("", "Acceptance Criteria:");
    story.acceptanceCriteria.forEach((ac, i) => {
      lines.push(`${i + 1}. ${ac.text}`);
    });
  }

  if (story.storyPoints !== undefined) {
    lines.push("", `Story Points: ${story.storyPoints}`);
  }

  if (story.labels.length > 0) {
    lines.push(`Labels: ${story.labels.join(", ")}`);
  }

  return lines.join("\n");
}

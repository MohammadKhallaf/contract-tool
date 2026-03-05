"use client";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Square } from "lucide-react";
import type { JiraStory } from "@/types";

interface Props {
  story: JiraStory;
}

export function StoryPreview({ story }: Props) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        {story.key && (
          <Badge variant="outline" className="font-mono">
            {story.key}
          </Badge>
        )}
        {story.priority && <Badge variant="secondary">{story.priority}</Badge>}
        {story.storyPoints !== undefined && (
          <Badge variant="secondary">{story.storyPoints} pts</Badge>
        )}
        {story.labels.map((l) => (
          <Badge key={l} variant="outline" className="text-xs">
            {l}
          </Badge>
        ))}
      </div>

      <h3 className="font-semibold text-base leading-snug">{story.title}</h3>

      {story.description && (
        <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {story.description}
        </p>
      )}

      {story.acceptanceCriteria.length > 0 && (
        <div>
          <p className="font-medium mb-1.5">Acceptance Criteria</p>
          <ol className="space-y-1">
            {story.acceptanceCriteria.map((ac) => (
              <li key={ac.id} className="flex items-start gap-2">
                {ac.checked ? (
                  <CheckSquare className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <span className="text-muted-foreground">{ac.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

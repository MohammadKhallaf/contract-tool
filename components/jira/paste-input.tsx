"use client";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { parseJiraText } from "@/lib/parsers/jira-parser";
import type { JiraStory } from "@/types";

interface Props {
  initialValue?: string;
  onParsed: (story: JiraStory) => void;
}

export function PasteInput({ initialValue = "", onParsed }: Props) {
  const [text, setText] = useState(initialValue);

  return (
    <div className="space-y-3">
      <Label htmlFor="jira-paste">Paste JIRA story text</Label>
      <Textarea
        id="jira-paste"
        placeholder="Paste JIRA story content here — title, description, acceptance criteria..."
        className="min-h-52 font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        disabled={!text.trim()}
        onClick={() => onParsed(parseJiraText(text))}
        className="w-full"
      >
        Parse Story
      </Button>
    </div>
  );
}

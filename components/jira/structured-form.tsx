"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import type { JiraStory, AcceptanceCriteria } from "@/types";

interface Props {
  initial?: Partial<JiraStory>;
  onSave: (story: JiraStory) => void;
}

export function StructuredForm({ initial, onSave }: Props) {
  const [key, setKey] = useState(initial?.key ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [storyPoints, setStoryPoints] = useState(
    initial?.storyPoints?.toString() ?? ""
  );
  const [priority, setPriority] = useState(initial?.priority ?? "");
  const [labels, setLabels] = useState<string[]>(initial?.labels ?? []);
  const [labelInput, setLabelInput] = useState("");
  const [acs, setAcs] = useState<AcceptanceCriteria[]>(
    initial?.acceptanceCriteria ?? []
  );
  const [acInput, setAcInput] = useState("");

  function addLabel() {
    const trimmed = labelInput.trim();
    if (trimmed && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed]);
      setLabelInput("");
    }
  }

  function addAC() {
    if (!acInput.trim()) return;
    setAcs([
      ...acs,
      { id: String(acs.length), text: acInput.trim(), checked: false },
    ]);
    setAcInput("");
  }

  function handleSave() {
    onSave({
      key: key || undefined,
      title: title || "Untitled Story",
      description,
      acceptanceCriteria: acs,
      storyPoints: storyPoints ? parseInt(storyPoints, 10) : undefined,
      labels,
      priority: priority || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>JIRA Key</Label>
          <Input placeholder="DBC-123" value={key} onChange={(e) => setKey(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Story Points</Label>
          <Input
            type="number"
            placeholder="5"
            value={storyPoints}
            onChange={(e) => setStoryPoints(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Title *</Label>
        <Input
          placeholder="As a user, I want to..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          placeholder="Story description..."
          className="min-h-24"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Priority</Label>
        <Input
          placeholder="High / Medium / Low"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Labels</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add label..."
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addLabel()}
          />
          <Button type="button" size="icon" variant="outline" onClick={addLabel}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {labels.map((l) => (
            <Badge key={l} variant="secondary" className="gap-1">
              {l}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setLabels(labels.filter((x) => x !== l))}
              />
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Acceptance Criteria</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add acceptance criterion..."
            value={acInput}
            onChange={(e) => setAcInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addAC()}
          />
          <Button type="button" size="icon" variant="outline" onClick={addAC}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ol className="space-y-1 mt-1">
          {acs.map((ac, i) => (
            <li key={ac.id} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground w-5 shrink-0">{i + 1}.</span>
              <span className="flex-1">{ac.text}</span>
              <X
                className="h-3 w-3 cursor-pointer text-muted-foreground mt-0.5 shrink-0"
                onClick={() => setAcs(acs.filter((a) => a.id !== ac.id))}
              />
            </li>
          ))}
        </ol>
      </div>

      <Button onClick={handleSave} className="w-full" disabled={!title.trim()}>
        Save Story
      </Button>
    </div>
  );
}

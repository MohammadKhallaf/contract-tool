"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StructuredForm } from "./structured-form";
import { StoryPreview } from "./story-preview";
import { DocxUpload } from "./docx-upload";
import { EpicFileImport } from "./epic-file-import";
import { parseMultipleJiraTexts } from "@/lib/parsers/jira-parser";
import { useContractStore } from "@/stores/contract-store";
import type { JiraStory } from "@/types";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";

export function JiraInput() {
  const jiraStories = useContractStore((s) => s.contract?.jiraStories ?? []);
  const addJiraStory = useContractStore((s) => s.addJiraStory);
  const updateJiraStory = useContractStore((s) => s.updateJiraStory);
  const removeJiraStory = useContractStore((s) => s.removeJiraStory);
  const setJiraStories = useContractStore((s) => s.setJiraStories);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addTab, setAddTab] = useState<"paste" | "structured" | "docx" | "import-file">("paste");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [collapsedIndexes, setCollapsedIndexes] = useState<Set<number>>(new Set());

  function toggleCollapsed(index: number) {
    setCollapsedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function handleAddParsed(story: JiraStory) {
    addJiraStory(story);
    setShowAddPanel(false);
    toast.success("Story added");
  }

  function handleMultiPaste(text: string) {
    const parsed = parseMultipleJiraTexts(text);
    if (parsed.length > 1) {
      setJiraStories([...jiraStories, ...parsed]);
      setShowAddPanel(false);
      toast.success(`${parsed.length} stories added`);
    } else if (parsed.length === 1) {
      addJiraStory(parsed[0]);
      setShowAddPanel(false);
      toast.success("Story added");
    }
  }

  function handleEditSave(index: number, story: JiraStory) {
    updateJiraStory(index, story);
    setEditingIndex(null);
    toast.success("Story updated");
  }

  return (
    <div className="space-y-4">
      {/* Story list */}
      {jiraStories.length > 0 && (
        <div className="space-y-2">
          {jiraStories.map((story, index) => {
            const isCollapsed = collapsedIndexes.has(index);
            const isEditing = editingIndex === index;
            const label = story.key
              ? `${story.key} — ${story.title}`
              : story.title;

            return (
              <Card key={index}>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center gap-2">
                    <button
                      className="flex-1 flex items-center gap-1.5 text-left text-sm font-medium hover:text-primary transition-colors"
                      onClick={() => toggleCollapsed(index)}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{label}</span>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditingIndex(editingIndex === index ? null : index);
                        if (isCollapsed) toggleCollapsed(index);
                      }}
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeJiraStory(index)}
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>

                {!isCollapsed && (
                  <CardContent className="pt-0 px-4 pb-4">
                    {isEditing ? (
                      <StructuredForm
                        initial={story}
                        onSave={(updated) => handleEditSave(index, updated)}
                      />
                    ) : (
                      <StoryPreview story={story} />
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add story button */}
      {!showAddPanel && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 w-full"
          onClick={() => setShowAddPanel(true)}
        >
          <Plus className="h-4 w-4" />
          {jiraStories.length === 0 ? "Add JIRA Story" : "Add Another Story"}
        </Button>
      )}

      {/* Add story panel */}
      {showAddPanel && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Add Story
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs
              value={addTab}
              onValueChange={(v) => setAddTab(v as "paste" | "structured" | "docx" | "import-file")}
            >
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="paste">Paste Text</TabsTrigger>
                <TabsTrigger value="structured">Structured Form</TabsTrigger>
                <TabsTrigger value="docx">Upload .docx</TabsTrigger>
                <TabsTrigger value="import-file">Import File</TabsTrigger>
              </TabsList>
              <TabsContent value="paste" className="mt-4">
                <MultiPasteInput onParsed={handleMultiPaste} />
              </TabsContent>
              <TabsContent value="structured" className="mt-4">
                <StructuredForm onSave={handleAddParsed} />
              </TabsContent>
              <TabsContent value="docx" className="mt-4">
                <DocxUpload
                  onParsed={(story) => {
                    handleAddParsed(story);
                  }}
                />
              </TabsContent>
              <TabsContent value="import-file" className="mt-4">
                <EpicFileImport
                  onImported={(stories) => {
                    setJiraStories([...jiraStories, ...stories]);
                    setShowAddPanel(false);
                    toast.success(
                      `${stories.length} ${stories.length === 1 ? "story" : "stories"} imported`,
                    );
                  }}
                />
              </TabsContent>
            </Tabs>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
              onClick={() => setShowAddPanel(false)}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {jiraStories.length === 0 && !showAddPanel && (
        <p className="text-xs text-muted-foreground text-center">
          No stories yet. Add a JIRA story to get started.
        </p>
      )}
    </div>
  );
}

// Multi-paste input that supports --- separator
function MultiPasteInput({ onParsed }: { onParsed: (text: string) => void }) {
  const [text, setText] = useState("");

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Paste one or more stories. Separate multiple stories with <code>---</code> on its own line,
        or start each with its JIRA key (e.g. <code>DBC-123</code>).
      </div>
      <textarea
        className="w-full min-h-52 font-mono text-sm border rounded-md p-3 bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Paste JIRA story content here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button
        disabled={!text.trim()}
        onClick={() => onParsed(text)}
        className="w-full"
      >
        Parse & Add
      </Button>
    </div>
  );
}

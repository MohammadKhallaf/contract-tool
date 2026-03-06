"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PasteInput } from "./paste-input";
import { StructuredForm } from "./structured-form";
import { StoryPreview } from "./story-preview";
import { DocxUpload } from "./docx-upload";
import { serializeJiraStory } from "@/lib/parsers/jira-parser";
import { useContractStore } from "@/stores/contract-store";
import type { JiraStory } from "@/types";
import { toast } from "sonner";

export function JiraInput() {
  const jiraStory = useContractStore((s) => s.contract?.jiraStory);
  const setJiraStory = useContractStore((s) => s.setJiraStory);
  const [activeTab, setActiveTab] = useState<"paste" | "structured" | "docx">("paste");

  function handleParsed(story: JiraStory) {
    setJiraStory(story);
    toast.success("Story parsed successfully");
  }

  function handleSwitchToStructured() {
    setActiveTab("structured");
  }

  return (
    <div className="space-y-4">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "paste" | "structured" | "docx")}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="paste">Paste Text</TabsTrigger>
          <TabsTrigger value="structured">Structured Form</TabsTrigger>
          <TabsTrigger value="docx">Upload .docx</TabsTrigger>
        </TabsList>
        <TabsContent value="paste" className="mt-4">
          <PasteInput
            initialValue={jiraStory ? serializeJiraStory(jiraStory) : ""}
            onParsed={(story) => {
              handleParsed(story);
              handleSwitchToStructured();
            }}
          />
        </TabsContent>
        <TabsContent value="structured" className="mt-4">
          <StructuredForm initial={jiraStory} onSave={handleParsed} />
        </TabsContent>
        <TabsContent value="docx" className="mt-4">
          <DocxUpload
            onParsed={(story) => {
              handleParsed(story);
              handleSwitchToStructured();
            }}
          />
        </TabsContent>
      </Tabs>

      {jiraStory && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Story Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StoryPreview story={jiraStory} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

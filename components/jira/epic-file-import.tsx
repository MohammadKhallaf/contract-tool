"use client";

import { useCallback, useRef, useState } from "react";
import { FileJson, Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { parseEpicJson, parseEpicMarkdown } from "@/lib/parsers/epic-import-parser";
import type { JiraStory } from "@/types";

interface Props {
  onImported: (stories: JiraStory[]) => void;
}

export function EpicFileImport({ onImported }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<JiraStory[] | null>(null);
  const [filename, setFilename] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setParsed(null);
    setIsLoading(true);
    setFilename(file.name);

    try {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase();
      let stories: JiraStory[];

      if (ext === "json") {
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error("Invalid JSON file.");
        }
        stories = parseEpicJson(json);
      } else if (ext === "md" || ext === "markdown") {
        stories = parseEpicMarkdown(text);
      } else {
        throw new Error("Only .json and .md files are supported.");
      }

      if (stories.length === 0) {
        throw new Error("No stories found in this file.");
      }

      setParsed(stories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  function handleConfirm() {
    if (parsed) onImported(parsed);
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          isLoading && "pointer-events-none opacity-60",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,.md,.markdown"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {isDragging ? (
            <Upload className="h-8 w-8 text-primary" />
          ) : (
            <FileJson className="h-8 w-8" />
          )}
          <p className="text-sm font-medium">
            {isDragging
              ? "Drop file here"
              : "Drag & drop an exported epic file, or click to browse"}
          </p>
          <p className="text-xs">Supports .json and .md from Epic Tree Export</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {parsed && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{filename}</span> —{" "}
            {parsed.length} {parsed.length === 1 ? "story" : "stories"} found
          </div>

          {/* Preview: first 3 story titles */}
          <ul className="text-sm space-y-1 border rounded-md p-3 bg-muted/30">
            {parsed.slice(0, 3).map((s, i) => (
              <li key={i} className="truncate text-foreground">
                <span className="text-muted-foreground font-mono text-xs mr-1.5">
                  {s.key ?? "—"}
                </span>
                {s.title}
              </li>
            ))}
            {parsed.length > 3 && (
              <li className="text-muted-foreground text-xs">
                + {parsed.length - 3} more…
              </li>
            )}
          </ul>

          <Button onClick={handleConfirm} className="w-full">
            Add {parsed.length} {parsed.length === 1 ? "Story" : "Stories"}
          </Button>
        </div>
      )}
    </div>
  );
}

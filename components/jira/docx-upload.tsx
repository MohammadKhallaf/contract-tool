"use client";
import { useCallback, useRef, useState } from "react";
import { FileText, Upload, Loader2, AlertCircle, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { extractDocxText } from "@/lib/parsers/docx-parser";
import { parseJiraText } from "@/lib/parsers/jira-parser";
import { compressDataUrl } from "@/lib/image-utils";
import { useContractStore } from "@/stores/contract-store";
import type { JiraStory } from "@/types";

const PREVIEW_LIMIT = 2000;

interface Props {
  onParsed: (story: JiraStory) => void;
}

interface Extracted {
  filename: string;
  text: string;
  imageDataUrls: string[];
  imageNames: string[];
}

export function DocxUpload({ onParsed }: Props) {
  const addScreen = useContractStore((s) => s.addScreen);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setExtracted(null);
    setIsLoading(true);
    try {
      const result = await extractDocxText(file);
      if (!result.text.trim()) {
        setError("No text content found in this document.");
        return;
      }
      const compressedUrls = await Promise.all(
        result.imageDataUrls.map((url) => compressDataUrl(url))
      );
      setExtracted({
        filename: file.name,
        text: result.text,
        imageDataUrls: compressedUrls,
        imageNames: result.imageNames,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract text from file.");
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
    [processFile]
  );

  function handleUse() {
    if (!extracted) return;

    // Add each embedded image as a screen so the AI analyzer picks them up
    for (let i = 0; i < extracted.imageDataUrls.length; i++) {
      addScreen({
        name: extracted.imageNames[i],
        dataUrl: extracted.imageDataUrls[i],
      });
    }

    // Prefix the text so the AI knows images are attached and referenced inline
    const imageNote =
      extracted.imageDataUrls.length > 0
        ? `[${extracted.imageDataUrls.length} image(s) from this document are attached as screens — referenced inline as [Image 1], [Image 2], etc.]\n\n`
        : "";

    const prefixed = `[From uploaded document: ${extracted.filename}]\n\n${imageNote}${extracted.text}`;
    onParsed(parseJiraText(prefixed));
  }

  const preview =
    extracted && extracted.text.length > PREVIEW_LIMIT
      ? extracted.text.slice(0, PREVIEW_LIMIT) + "\n\n... [truncated]"
      : extracted?.text ?? "";

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          isLoading && "pointer-events-none opacity-60"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            e.target.value = "";
          }}
        />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : isDragging ? (
            <Upload className="h-8 w-8 text-primary" />
          ) : (
            <FileText className="h-8 w-8" />
          )}
          <p className="text-sm font-medium">
            {isLoading
              ? "Extracting text and images…"
              : isDragging
              ? "Drop .docx file here"
              : "Drag & drop a .docx file, or click to browse"}
          </p>
          {!isLoading && (
            <p className="text-xs">Microsoft Word documents (.docx) only</p>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {extracted && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground truncate max-w-[60%]">
              {extracted.filename}
            </span>
            <span className="text-muted-foreground">
              {extracted.text.length.toLocaleString()} chars
              {extracted.imageDataUrls.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Image className="h-3 w-3" />
                  {extracted.imageDataUrls.length} image{extracted.imageDataUrls.length !== 1 ? "s" : ""}
                </span>
              )}
            </span>
          </div>

          {extracted.imageDataUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {extracted.imageDataUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={extracted.imageNames[i]}
                  title={extracted.imageNames[i]}
                  className="h-16 w-24 object-cover rounded border"
                />
              ))}
            </div>
          )}

          <Textarea
            value={preview}
            readOnly
            className="font-mono text-xs h-48 resize-none bg-muted/30"
          />

          <Button onClick={handleUse} className="w-full">
            Use this text{extracted.imageDataUrls.length > 0 ? ` + ${extracted.imageDataUrls.length} image(s)` : ""}
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";
import { useCallback, useRef, useState } from "react";
import { Upload, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { compressFile } from "@/lib/image-utils";
import { useContractStore } from "@/stores/contract-store";
import { toast } from "sonner";

export function ScreenUpload() {
  const addScreen = useContractStore((s) => s.addScreen);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (!images.length) {
        toast.error("Please upload image files (PNG, JPG, SVG)");
        return;
      }
      for (const file of images) {
        try {
          const dataUrl = await compressFile(file);
          addScreen({ name: file.name.replace(/\.[^.]+$/, ""), dataUrl });
        } catch {
          toast.error(`Failed to process ${file.name}`);
        }
      }
      toast.success(`${images.length} screen(s) added`);
    },
    [addScreen]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        multiple
        className="hidden"
        onChange={(e) => processFiles(Array.from(e.target.files ?? []))}
      />
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        {isDragging ? (
          <Upload className="h-8 w-8 text-primary" />
        ) : (
          <ImagePlus className="h-8 w-8" />
        )}
        <p className="text-sm font-medium">
          {isDragging ? "Drop screens here" : "Drag & drop screens, or click to browse"}
        </p>
        <p className="text-xs">PNG, JPG, SVG — multiple files supported</p>
      </div>
    </div>
  );
}

"use client";
import { useCallback, useRef, useState } from "react";
import { Upload, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContractStore } from "@/stores/contract-store";
import { toast } from "sonner";

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxSize = 1920;
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

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
          const dataUrl = await compressImage(file);
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

"use client";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import type { GeneratedType } from "@/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      Loading editor...
    </div>
  ),
});

interface Props {
  type: GeneratedType;
  onChange: (code: string) => void;
  onReset: () => void;
}

export function TypeEditor({ type, onChange, onReset }: Props) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <span className="text-sm font-mono font-medium">{type.name}</span>
        {type.isEdited && (
          <Badge variant="secondary" className="text-[10px]">edited</Badge>
        )}
        <div className="flex-1" />
        {type.isEdited && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs gap-1"
            onClick={onReset}
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
        )}
      </div>
      <div className="flex-1 min-h-40">
        <MonacoEditor
          language="typescript"
          value={type.code}
          theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
          onChange={(v) => { if (v !== undefined) onChange(v); }}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}

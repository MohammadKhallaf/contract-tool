"use client";
import { useSettingsStore } from "@/stores/settings-store";
import { useSpecsStore } from "@/stores/specs-store";
import { extractPatterns, type PatternItem } from "@/lib/specs/pattern-extractor";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, List, Box, AlertTriangle, Hash, RotateCcw } from "lucide-react";

const KIND_ICON: Record<PatternItem["kind"], React.ReactNode> = {
  auth_header: <Shield className="h-3.5 w-3.5 text-blue-500" />,
  pagination: <List className="h-3.5 w-3.5 text-green-500" />,
  common_schema: <Box className="h-3.5 w-3.5 text-purple-500" />,
  error_shape: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
  naming_prefix: <Hash className="h-3.5 w-3.5 text-orange-500" />,
};

const KIND_LABEL: Record<PatternItem["kind"], string> = {
  auth_header: "Auth",
  pagination: "Pagination",
  common_schema: "Schema",
  error_shape: "Error",
  naming_prefix: "Prefix",
};

export function PatternPicker() {
  const specs = useSpecsStore((s) => s.specs);
  const { patternSelections, setPatternSelection, resetPatternSelections } = useSettingsStore();

  const allPatterns = extractPatterns(Object.values(specs));

  if (Object.keys(specs).length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No specs loaded — go to Settings → Swagger Specs to load them.
      </p>
    );
  }

  if (allPatterns.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No patterns detected in loaded specs.
      </p>
    );
  }

  const selectedCount = allPatterns.filter((p) => {
    const sel = patternSelections[p.id];
    return sel ? sel.enabled : p.enabled;
  }).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{selectedCount}</span> / {allPatterns.length} selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1"
          onClick={resetPatternSelections}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      </div>

      <div className="space-y-2">
        {allPatterns.map((pattern) => {
          const sel = patternSelections[pattern.id];
          const enabled = sel ? sel.enabled : pattern.enabled;
          const weight = sel ? sel.weight : pattern.weight;

          return (
            <div
              key={pattern.id}
              className={`rounded-md border p-3 space-y-2 transition-colors ${
                enabled ? "border-border bg-background" : "border-border/50 bg-muted/30"
              }`}
            >
              <div className="flex items-start gap-2">
                <Checkbox
                  id={pattern.id}
                  checked={enabled}
                  onCheckedChange={(checked) =>
                    setPatternSelection(pattern.id, Boolean(checked), weight)
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {KIND_ICON[pattern.kind]}
                    <label
                      htmlFor={pattern.id}
                      className="text-xs font-medium cursor-pointer leading-none"
                    >
                      {pattern.label}
                    </label>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      {KIND_LABEL[pattern.kind]}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {pattern.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {pattern.sourceProjects.map((p) => (
                      <Badge key={p} variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {enabled && (
                <div className="flex items-center gap-3 pl-6">
                  <span className="text-[10px] text-muted-foreground w-12 shrink-0">
                    Weight {Math.round(weight * 100)}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={Math.round(weight * 100)}
                    onChange={(e) =>
                      setPatternSelection(pattern.id, true, Number(e.target.value) / 100)
                    }
                    className="flex-1 accent-primary"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

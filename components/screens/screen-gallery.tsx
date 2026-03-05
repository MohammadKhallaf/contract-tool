"use client";
import { useContractStore } from "@/stores/contract-store";
import { useUIStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Screen } from "@/types";

interface Props {
  screens: Screen[];
}

export function ScreenGallery({ screens }: Props) {
  const removeScreen = useContractStore((s) => s.removeScreen);
  const selectedId = useUIStore((s) => s.selectedScreenId);
  const setSelectedId = useUIStore((s) => s.setSelectedScreenId);
  const annotations = useContractStore((s) => s.contract?.annotations ?? []);

  if (screens.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {screens.map((screen) => {
        const annCount = annotations.filter((a) => a.screenId === screen.id).length;
        return (
          <div
            key={screen.id}
            className={cn(
              "relative group rounded-lg border-2 overflow-hidden cursor-pointer transition-all",
              selectedId === screen.id
                ? "border-primary"
                : "border-border hover:border-primary/50"
            )}
            onClick={() => setSelectedId(screen.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screen.dataUrl}
              alt={screen.name}
              className="w-full h-24 object-cover"
            />
            <div className="p-1.5 bg-background/80 backdrop-blur-sm">
              <p className="text-xs font-medium truncate">{screen.name}</p>
            </div>
            {annCount > 0 && (
              <Badge className="absolute top-1 left-1 h-5 text-[10px] px-1">
                {annCount}
              </Badge>
            )}
            <Button
              size="icon"
              variant="destructive"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                removeScreen(screen.id);
                if (selectedId === screen.id) setSelectedId(null);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

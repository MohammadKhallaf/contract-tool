"use client";
import { useRef, useState } from "react";
import { useContractStore } from "@/stores/contract-store";
import { useUIStore } from "@/stores/ui-store";
import { useShallow } from "zustand/react/shallow";
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
  const updateScreen = useContractStore((s) => s.updateScreen);
  const reorderScreens = useContractStore((s) => s.reorderScreens);
  const selectedId = useUIStore((s) => s.selectedScreenId);
  const setSelectedId = useUIStore((s) => s.setSelectedScreenId);
  const annotations = useContractStore(useShallow((s) => s.contract?.annotations ?? []));

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const dragOverId = useRef<string | null>(null);
  const draggingId = useRef<string | null>(null);

  if (screens.length === 0) return null;

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) updateScreen(id, { name: trimmed });
    setRenamingId(null);
  }

  function handleDragStart(id: string) {
    draggingId.current = id;
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    dragOverId.current = id;
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const from = draggingId.current;
    const to = dragOverId.current;
    if (!from || !to || from === to) return;

    const ids = screens.map((s) => s.id);
    const fromIdx = ids.indexOf(from);
    const toIdx = ids.indexOf(to);
    const reordered = [...ids];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, from);
    reorderScreens(reordered);

    draggingId.current = null;
    dragOverId.current = null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {screens.map((screen) => {
        const annCount = annotations.filter((a) => a.screenId === screen.id).length;
        return (
          <div
            key={screen.id}
            draggable
            onDragStart={() => handleDragStart(screen.id)}
            onDragOver={(e) => handleDragOver(e, screen.id)}
            onDrop={handleDrop}
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
              {renamingId === screen.id ? (
                <input
                  autoFocus
                  className="w-full text-xs font-medium bg-transparent border-b border-primary outline-none"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(screen.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(screen.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <p
                  className="text-xs font-medium truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(screen.id);
                    setRenameValue(screen.name);
                  }}
                  title="Double-click to rename"
                >
                  {screen.name}
                </p>
              )}
            </div>
            {annCount > 0 && (
              <Badge className="absolute top-1 left-1 h-5 text-[10px] px-1">
                {annCount}
              </Badge>
            )}
            {screen.notes && (
              <div
                className="absolute top-1 right-6 h-4 w-4 rounded-full bg-amber-400/90 flex items-center justify-center"
                title="Has notes"
              >
                <span className="text-[8px] font-bold text-white">N</span>
              </div>
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

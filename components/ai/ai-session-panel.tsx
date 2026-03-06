"use client";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, X, CheckSquare, Square, Send, Loader2, AlertCircle } from "lucide-react";
import { StagedEndpointRow } from "./staged-endpoint-row";
import { ChatMessage } from "./chat-message";
import { useAISession } from "@/hooks/use-ai-session";
import type { Endpoint } from "@/types";

interface Props {
  initialEndpoints: Partial<Endpoint>[];
  initialReasoning?: string;
  overrideMode: boolean;
  onCommit: (endpoints: Partial<Endpoint>[]) => void;
  onClose: () => void;
}

export function AISessionPanel({
  initialEndpoints,
  initialReasoning,
  overrideMode,
  onCommit,
  onClose,
}: Props) {
  const session = useAISession();
  const [followUp, setFollowUp] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize session on mount
  useEffect(() => {
    if (!session.isActive) {
      session.startSession(initialEndpoints, initialReasoning);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session.messages]);

  const acceptedCount = session.stagedEndpoints.filter(
    (s) => s.accepted && s.status !== "removed"
  ).length;
  const totalCount = session.stagedEndpoints.filter(
    (s) => s.status !== "removed"
  ).length;

  function handleCommit() {
    if (acceptedCount === 0) return;
    const endpoints = session.commitAccepted();
    onCommit(endpoints);
  }

  function handleClose() {
    if (session.stagedEndpoints.length > 0) {
      setCloseConfirmOpen(true);
    } else {
      session.closeSession();
      onClose();
    }
  }

  function confirmClose() {
    session.closeSession();
    onClose();
    setCloseConfirmOpen(false);
  }

  async function handleSendFollowUp() {
    const msg = followUp.trim();
    if (!msg || session.isLoading) return;
    setFollowUp("");
    await session.sendFollowUp(msg);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendFollowUp();
    }
  }

  return (
    <>
      <div className="border-b bg-muted/30 animate-in slide-in-from-top-2 duration-300">
        {/* Header */}
        <div className="px-4 py-2 flex items-center gap-3 border-b">
          <h3 className="text-sm font-semibold">AI Session</h3>
          <Badge variant="outline" className="text-xs">
            {acceptedCount} of {totalCount} selected
          </Badge>
          {overrideMode && (
            <Badge variant="secondary" className="text-[10px] text-amber-600 dark:text-amber-400">
              Replace mode
            </Badge>
          )}
          <div className="flex-1" />
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleCommit}
            disabled={acceptedCount === 0}
          >
            <Check className="h-3 w-3" />
            Commit ({acceptedCount})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs"
            onClick={handleClose}
          >
            <X className="h-3 w-3" />
            Close
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {/* Bulk actions + Staged endpoints */}
          <div className="px-4 py-2 space-y-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 text-[11px]"
                onClick={session.acceptAll}
              >
                <CheckSquare className="h-3 w-3" />
                Select All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 gap-1 text-[11px]"
                onClick={session.rejectAll}
              >
                <Square className="h-3 w-3" />
                Deselect All
              </Button>
            </div>

            {session.isLoading && session.stagedEndpoints.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="space-y-1.5">
                {session.stagedEndpoints.map((staged, i) => (
                  <StagedEndpointRow
                    key={`${staged.endpoint.method}-${staged.endpoint.path}-${i}`}
                    staged={staged}
                    index={i}
                    onToggle={session.toggleEndpoint}
                    onEdit={session.updateStagedEndpoint}
                  />
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Chat history */}
          <div className="px-4 py-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Chat
            </p>
            <ScrollArea className="max-h-48">
              <div className="space-y-2 pr-2">
                {session.messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                {session.isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {session.error && (
              <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span className="truncate">{session.error}</span>
              </div>
            )}

            {/* Follow-up input */}
            <div className="flex gap-2 mt-2">
              <Textarea
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a follow-up instruction... (Ctrl+Enter to send)"
                className="text-xs min-h-[60px] resize-none flex-1"
                disabled={session.isLoading}
              />
              <Button
                size="sm"
                className="h-auto px-3 self-end"
                onClick={handleSendFollowUp}
                disabled={!followUp.trim() || session.isLoading}
              >
                {session.isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard AI session?</AlertDialogTitle>
            <AlertDialogDescription>
              You have {totalCount} staged endpoint{totalCount !== 1 ? "s" : ""} that haven&apos;t been committed.
              Closing will discard all changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

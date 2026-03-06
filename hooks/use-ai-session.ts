"use client";
import { useState, useCallback, useRef } from "react";
import type { Endpoint, AIMessage, StagedEndpoint, StagedEndpointStatus } from "@/types";
import type { AIProvider } from "@/lib/ai/provider";
import { buildFollowUpPrompt } from "@/lib/ai/prompts";
import { useSettingsStore } from "@/stores/settings-store";
import { useContractStore } from "@/stores/contract-store";
import { ClaudeProvider } from "@/lib/ai/claude-provider";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import { PoeProvider } from "@/lib/ai/poe-provider";

function makeId() {
  return crypto.randomUUID();
}

function getProvider(): AIProvider | null {
  const { aiProvider, apiKey, model } = useSettingsStore.getState();
  const primaryModel = model || (aiProvider === "claude" ? "claude-sonnet-4-6" : aiProvider === "openai" ? "gpt-4o" : "Claude-Sonnet-4.5");
  if (aiProvider === "claude") return new ClaudeProvider(apiKey, primaryModel);
  if (aiProvider === "openai") return new OpenAIProvider(apiKey, primaryModel);
  if (aiProvider === "poe") return new PoeProvider(apiKey, primaryModel);
  return null;
}

function endpointKey(ep: Partial<Endpoint>): string {
  return `${(ep.method ?? "GET").toUpperCase()}:${ep.path ?? ""}`;
}

function diffEndpoints(
  oldStaged: StagedEndpoint[],
  newEndpoints: Partial<Endpoint>[]
): StagedEndpoint[] {
  const oldMap = new Map<string, StagedEndpoint>();
  for (const s of oldStaged) {
    oldMap.set(endpointKey(s.endpoint), s);
  }

  const newMap = new Map<string, Partial<Endpoint>>();
  for (const ep of newEndpoints) {
    newMap.set(endpointKey(ep), ep);
  }

  const result: StagedEndpoint[] = [];
  const seen = new Set<string>();

  for (const ep of newEndpoints) {
    const key = endpointKey(ep);
    seen.add(key);
    const old = oldMap.get(key);
    if (!old) {
      result.push({ endpoint: ep, status: "new", accepted: true });
    } else {
      const changed = JSON.stringify(ep) !== JSON.stringify(old.endpoint);
      const status: StagedEndpointStatus = changed ? "modified" : "unchanged";
      result.push({ endpoint: ep, status, accepted: old.accepted });
    }
  }

  // Mark removed endpoints
  for (const s of oldStaged) {
    const key = endpointKey(s.endpoint);
    if (!seen.has(key)) {
      result.push({ endpoint: s.endpoint, status: "removed", accepted: false });
    }
  }

  return result;
}

export interface AISessionState {
  isActive: boolean;
  messages: AIMessage[];
  stagedEndpoints: StagedEndpoint[];
  isLoading: boolean;
  error: string | null;
}

export interface AISessionActions {
  startSession: (endpoints: Partial<Endpoint>[], reasoning?: string) => void;
  sendFollowUp: (message: string) => Promise<void>;
  toggleEndpoint: (index: number) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  updateStagedEndpoint: (index: number, changes: Partial<Endpoint>) => void;
  commitAccepted: () => Partial<Endpoint>[];
  closeSession: () => void;
}

export function useAISession(): AISessionState & AISessionActions {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [stagedEndpoints, setStagedEndpoints] = useState<StagedEndpoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<AIMessage[]>([]);

  const startSession = useCallback((endpoints: Partial<Endpoint>[], reasoning?: string) => {
    const staged = endpoints.map((ep) => ({
      endpoint: ep,
      status: "new" as StagedEndpointStatus,
      accepted: true,
    }));
    setStagedEndpoints(staged);

    const firstMessage: AIMessage = {
      id: makeId(),
      role: "assistant",
      content: reasoning ?? `Generated ${endpoints.length} endpoint(s) from analysis.`,
      endpoints,
      timestamp: Date.now(),
    };
    const msgs = [firstMessage];
    setMessages(msgs);
    messagesRef.current = msgs;
    setIsActive(true);
    setError(null);
  }, []);

  const sendFollowUp = useCallback(async (userMessage: string) => {
    setIsLoading(true);
    setError(null);

    const userMsg: AIMessage = {
      id: makeId(),
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    };
    const updatedMessages = [...messagesRef.current, userMsg];
    setMessages(updatedMessages);
    messagesRef.current = updatedMessages;

    try {
      const provider = getProvider();
      if (!provider?.chat) {
        throw new Error("AI provider does not support chat. Check your settings.");
      }

      const contract = useContractStore.getState().contract;
      const customInstructions = contract?.aiInstructions;

      // Get current accepted endpoints for context
      let currentEndpoints: Partial<Endpoint>[] = [];
      setStagedEndpoints((prev) => {
        currentEndpoints = prev.filter((s) => s.status !== "removed").map((s) => s.endpoint);
        return prev;
      });

      const followUpPrompt = buildFollowUpPrompt(currentEndpoints, userMessage, customInstructions);

      // Build message history for the API - only last 3 turns + current
      const recentMessages = messagesRef.current.slice(-6); // Last 3 pairs max
      const apiMessages: Array<{ role: string; content: unknown[] }> = recentMessages.map((m, idx) => ({
        role: m.role,
        content: idx === recentMessages.length - 1 && m.role === "user"
          ? [{ type: "text", text: followUpPrompt }]
          : [{ type: "text", text: m.content }],
      }));

      // Ensure messages alternate correctly starting with user
      // Claude API requires messages to alternate user/assistant
      const normalizedMessages: Array<{ role: string; content: unknown[] }> = [];
      for (const msg of apiMessages) {
        const last = normalizedMessages[normalizedMessages.length - 1];
        if (last && last.role === msg.role) {
          // Merge consecutive same-role messages
          last.content.push(...msg.content);
        } else {
          normalizedMessages.push({ ...msg });
        }
      }

      // Ensure first message is user role
      if (normalizedMessages.length > 0 && normalizedMessages[0].role !== "user") {
        normalizedMessages.shift();
      }

      const result = await provider.chat(normalizedMessages);

      const assistantMsg: AIMessage = {
        id: makeId(),
        role: "assistant",
        content: result.reasoning ?? `Updated endpoints based on: "${userMessage}"`,
        endpoints: result.endpoints,
        timestamp: Date.now(),
      };
      const finalMessages = [...messagesRef.current, assistantMsg];
      setMessages(finalMessages);
      messagesRef.current = finalMessages;

      if (result.endpoints.length > 0) {
        setStagedEndpoints((prev) => diffEndpoints(prev, result.endpoints));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleEndpoint = useCallback((index: number) => {
    setStagedEndpoints((prev) =>
      prev.map((s, i) => (i === index ? { ...s, accepted: !s.accepted } : s))
    );
  }, []);

  const acceptAll = useCallback(() => {
    setStagedEndpoints((prev) =>
      prev.map((s) => (s.status !== "removed" ? { ...s, accepted: true } : s))
    );
  }, []);

  const rejectAll = useCallback(() => {
    setStagedEndpoints((prev) => prev.map((s) => ({ ...s, accepted: false })));
  }, []);

  const updateStagedEndpoint = useCallback((index: number, changes: Partial<Endpoint>) => {
    setStagedEndpoints((prev) =>
      prev.map((s, i) => (i === index ? { ...s, endpoint: { ...s.endpoint, ...changes } } : s))
    );
  }, []);

  const commitAccepted = useCallback((): Partial<Endpoint>[] => {
    const accepted = stagedEndpoints
      .filter((s) => s.accepted && s.status !== "removed")
      .map((s) => s.endpoint);
    setIsActive(false);
    setMessages([]);
    messagesRef.current = [];
    setStagedEndpoints([]);
    setError(null);
    return accepted;
  }, [stagedEndpoints]);

  const closeSession = useCallback(() => {
    setIsActive(false);
    setMessages([]);
    messagesRef.current = [];
    setStagedEndpoints([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    isActive,
    messages,
    stagedEndpoints,
    isLoading,
    error,
    startSession,
    sendFollowUp,
    toggleEndpoint,
    acceptAll,
    rejectAll,
    updateStagedEndpoint,
    commitAccepted,
    closeSession,
  };
}

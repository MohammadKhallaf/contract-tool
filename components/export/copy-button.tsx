"use client";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useClipboard } from "@/hooks/use-clipboard";

interface Props {
  text: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
}

export function CopyButton({ text, label = "Copy", variant = "outline", size = "sm" }: Props) {
  const { copied, copy } = useClipboard();

  return (
    <Button variant={variant} size={size} onClick={() => copy(text)} className="gap-1.5">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {size !== "icon" && (copied ? "Copied!" : label)}
    </Button>
  );
}

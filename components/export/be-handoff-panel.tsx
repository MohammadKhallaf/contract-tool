"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useContractStore } from "@/stores/contract-store";
import { generateBeHandoff } from "@/lib/generators/be-handoff-generator";
import type { ContractStack } from "@/types";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STACK_FIELDS: { key: keyof ContractStack; label: string; placeholder: string }[] = [
  { key: "backend", label: "Backend", placeholder: "e.g. PHP 8.2" },
  { key: "framework", label: "Framework", placeholder: "e.g. Laravel 11" },
  { key: "database", label: "Database", placeholder: "e.g. PostgreSQL 15" },
  { key: "frontend", label: "Frontend", placeholder: "e.g. Next.js 16 / React 19" },
  { key: "auth", label: "Auth", placeholder: "e.g. JWT / OAuth2" },
];

export function BeHandoffPanel() {
  const contract = useContractStore((s) => s.contract);
  const updateStack = useContractStore((s) => s.updateStack);

  const [draft, setDraft] = useState<ContractStack>({
    backend: contract?.stack?.backend ?? "",
    framework: contract?.stack?.framework ?? "",
    database: contract?.stack?.database ?? "",
    frontend: contract?.stack?.frontend ?? "",
    auth: contract?.stack?.auth ?? "",
  });
  const [copied, setCopied] = useState(false);

  if (!contract) return null;

  const stackForGen = Object.values(draft).some(Boolean) ? draft : contract.stack;
  const contractWithDraft = { ...contract, stack: stackForGen };
  const content = generateBeHandoff(contractWithDraft);
  const slug = contract.name.replaceAll(" ", "-").toLowerCase();

  function handleFieldChange(key: keyof ContractStack, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
  }

  function handleFieldBlur() {
    updateStack(draft);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    downloadFile(content, `${slug}-be-handoff.md`, "text/markdown");
  }

  return (
    <div className="space-y-4">
      {/* Tech Stack Form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tech Stack</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {STACK_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Input
                  placeholder={placeholder}
                  value={draft[key]}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  onBlur={handleFieldBlur}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Download BE Reference MD
        </Button>
      </div>

      <Separator />

      {/* Live preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none overflow-auto max-h-[60vh]">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

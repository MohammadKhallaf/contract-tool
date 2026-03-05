"use client";
import { useContractStore } from "@/stores/contract-store";
import { generateMarkdown } from "@/lib/generators/markdown-generator";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Download } from "lucide-react";
import { CopyButton } from "./copy-button";
import dynamic from "next/dynamic";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

export function ExportPanel() {
  const contract = useContractStore((s) => s.contract);

  if (!contract) return null;

  const markdown = generateMarkdown(contract);

  const typesCode = contract.generatedTypes.map((t) => t.code).join("\n\n");
  const schemasCode = [
    "import * as yup from 'yup';",
    "",
    ...contract.generatedSchemas.map((s) => s.code),
  ].join("\n");

  const endpointTable = contract.endpoints
    .filter((ep) => ep.enabled)
    .map((ep) => `| \`${ep.method}\` | \`${ep.path}\` | ${ep.description} |`)
    .join("\n");
  const endpointMarkdown = `| Method | Path | Description |\n|--------|------|-------------|\n${endpointTable}`;

  function downloadJson() {
    if (!contract) return;
    const blob = new Blob([JSON.stringify(contract, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${contract.name.replace(/\s+/g, "-").toLowerCase()}-contract.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <CopyButton text={markdown} label="Copy Full Markdown" />
        <CopyButton text={typesCode} label="Copy Types" />
        <CopyButton text={schemasCode} label="Copy Schemas" />
        <CopyButton text={endpointMarkdown} label="Copy Endpoint Table" />
        <Button variant="outline" size="sm" onClick={downloadJson} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Download JSON
        </Button>
      </div>

      <Separator />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Markdown Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none overflow-auto max-h-[60vh]">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

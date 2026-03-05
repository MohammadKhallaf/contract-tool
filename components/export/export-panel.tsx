"use client";
import { Download } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { generateMarkdown } from "@/lib/generators/markdown-generator";
import { generateOpenApi, generateOpenApiYaml } from "@/lib/generators/openapi-generator";
import { generateSwagger } from "@/lib/generators/swagger-generator";
import { generateYaml } from "@/lib/generators/yaml-generator";
import { useContractStore } from "@/stores/contract-store";
import { CopyButton } from "./copy-button";

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

export function ExportPanel() {
  const contract = useContractStore((s) => s.contract);

  if (!contract) return null;

  // contract is narrowed to Contract (non-null) past this point
  const c = contract;
  const slug = c.name.replaceAll(" ", "-").toLowerCase();
  const markdown = generateMarkdown(c);

  const typesCode = c.generatedTypes.map((t) => t.code).join("\n\n");
  const schemasCode = [
    "import * as yup from 'yup';",
    "",
    ...c.generatedSchemas.map((s) => s.code),
  ].join("\n");

  const endpointTable = c.endpoints
    .filter((ep) => ep.enabled)
    .map((ep) => `| \`${ep.method}\` | \`${ep.path}\` | ${ep.description} |`)
    .join("\n");
  const endpointMarkdown = `| Method | Path | Description |\n|--------|------|-------------|\n${endpointTable}`;

  function downloadJson() {
    downloadFile(JSON.stringify(c, null, 2), `${slug}-contract.json`, "application/json");
  }

  function downloadMarkdown() {
    downloadFile(markdown, `${slug}-contract.md`, "text/markdown");
  }

  function downloadYaml() {
    downloadFile(generateYaml(c), `${slug}-contract.yaml`, "text/yaml");
  }

  function downloadOpenApiJson() {
    downloadFile(
      JSON.stringify(generateOpenApi(c), null, 2),
      `${slug}-openapi.json`,
      "application/json"
    );
  }

  function downloadOpenApiYaml() {
    downloadFile(generateOpenApiYaml(c), `${slug}-openapi.yaml`, "text/yaml");
  }

  function downloadSwaggerJson() {
    downloadFile(
      JSON.stringify(generateSwagger(c), null, 2),
      `${slug}-swagger.json`,
      "application/json"
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Copy</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={markdown} label="Full Markdown" />
          <CopyButton text={typesCode} label="Types" />
          <CopyButton text={schemasCode} label="Schemas" />
          <CopyButton text={endpointMarkdown} label="Endpoint Table" />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Download</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadMarkdown} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Markdown
          </Button>
          <Button variant="outline" size="sm" onClick={downloadJson} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> JSON
          </Button>
          <Button variant="outline" size="sm" onClick={downloadYaml} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> YAML
          </Button>
          <Button variant="outline" size="sm" onClick={downloadOpenApiJson} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> OpenAPI JSON
          </Button>
          <Button variant="outline" size="sm" onClick={downloadOpenApiYaml} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> OpenAPI YAML
          </Button>
          <Button variant="outline" size="sm" onClick={downloadSwaggerJson} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Swagger 2.0 JSON
          </Button>
        </div>
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

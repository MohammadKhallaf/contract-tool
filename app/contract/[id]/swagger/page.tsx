"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SwaggerFrame } from "@/components/export/swagger-frame";
import { useContractStore } from "@/stores/contract-store";
import { generateOpenApi } from "@/lib/generators/openapi-generator";

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SwaggerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const contract = useContractStore((s) => s.contract);

  useEffect(() => {
    if (!contract || contract.id !== id) {
      router.push("/");
    }
  }, [contract, id, router]);

  if (!contract || contract.id !== id) return null;

  const spec = generateOpenApi(contract);
  const slug = contract.name.replaceAll(" ", "-").toLowerCase();

  function handleDownload() {
    downloadFile(JSON.stringify(spec, null, 2), `${slug}-openapi.json`, "application/json");
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/contract/${id}`)}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <span className="font-medium text-sm truncate flex-1">{contract.name}</span>
        <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          OpenAPI JSON
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <SwaggerFrame spec={spec} />
      </div>
    </div>
  );
}

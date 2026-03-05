"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useContractStore } from "@/stores/contract-store";
import { useContractsListStore } from "@/stores/contracts-list-store";
import { useUIStore } from "@/stores/ui-store";
import { Header } from "@/components/layout/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JiraInput } from "@/components/jira/jira-input";
import { ScreenUpload } from "@/components/screens/screen-upload";
import { ScreenGallery } from "@/components/screens/screen-gallery";
import { ScreenViewer } from "@/components/screens/screen-viewer";
import { EndpointTable } from "@/components/endpoints/endpoint-table";
import { TypeList } from "@/components/types-editor/type-list";
import { SchemaList } from "@/components/schemas/schema-list";
import { ExportPanel } from "@/components/export/export-panel";
import { AIAnalyzer } from "@/components/ai/ai-analyzer";
import { Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useContractSave } from "@/hooks/use-contract";

export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const contract = useContractStore((s) => s.contract);
  const updateName = useContractStore((s) => s.updateName);
  const activePanel = useUIStore((s) => s.activePanel);
  const setActivePanel = useUIStore((s) => s.setActivePanel);
  const selectedScreenId = useUIStore((s) => s.selectedScreenId);
  const save = useContractSave();
  const contractsList = useContractsListStore((s) => s.contracts);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(contract?.name ?? "");

  // If contract id doesn't match currently loaded, redirect to dashboard
  useEffect(() => {
    if (contract && contract.id !== id) {
      router.push("/");
    }
    if (!contract) {
      // Check if this contract exists in the list (already saved)
      const exists = contractsList.find((c) => c.id === id);
      if (!exists) router.push("/");
    }
  }, [contract, id, router, contractsList]);

  useEffect(() => {
    if (contract) setNameValue(contract.name);
  }, [contract]);

  if (!contract || contract.id !== id) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const selectedScreen = contract.screens.find((s) => s.id === selectedScreenId);

  function handleSave() {
    save();
    toast.success("Contract saved");
  }

  function handleNameSave() {
    updateName(nameValue);
    setEditingName(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {/* Workspace header */}
      <div className="border-b px-4 py-2 flex items-center gap-3 bg-background/95 sticky top-14 z-40">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/")}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {editingName ? (
          <Input
            className="h-8 text-sm font-semibold max-w-xs"
            value={nameValue}
            autoFocus
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
          />
        ) : (
          <button
            className="text-sm font-semibold hover:text-primary transition-colors"
            onClick={() => setEditingName(true)}
          >
            {contract.name}
          </button>
        )}
        <div className="flex-1" />
        <AIAnalyzer />
        <Button size="sm" onClick={handleSave} className="gap-1.5">
          <Save className="h-4 w-4" /> Save
        </Button>
      </div>

      {/* Main workspace */}
      <main className="flex-1 container mx-auto px-4 py-4 max-w-5xl">
        <Tabs
          value={activePanel}
          onValueChange={(v) => setActivePanel(v as typeof activePanel)}
        >
          <TabsList className="grid grid-cols-6 w-full mb-4">
            <TabsTrigger value="jira">JIRA</TabsTrigger>
            <TabsTrigger value="screens">
              Screens
              {contract.screens.length > 0 && (
                <span className="ml-1 text-[10px] opacity-60">
                  ({contract.screens.length})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="endpoints">
              Endpoints
              {contract.endpoints.length > 0 && (
                <span className="ml-1 text-[10px] opacity-60">
                  ({contract.endpoints.length})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="types">Types</TabsTrigger>
            <TabsTrigger value="schemas">Schemas</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="jira">
            <JiraInput />
          </TabsContent>

          <TabsContent value="screens">
            <div className="space-y-4">
              <ScreenUpload />
              <ScreenGallery screens={contract.screens} />
              {selectedScreen && (
                <div className="h-[60vh]">
                  <ScreenViewer screen={selectedScreen} />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="endpoints">
            <EndpointTable />
          </TabsContent>

          <TabsContent value="types">
            <TypeList />
          </TabsContent>

          <TabsContent value="schemas">
            <SchemaList />
          </TabsContent>

          <TabsContent value="export">
            <ExportPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

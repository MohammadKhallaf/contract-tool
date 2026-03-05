"use client";
import { useRouter } from "next/navigation";
import { useContractsListStore } from "@/stores/contracts-list-store";
import { useContractStore } from "@/stores/contract-store";
import { useContractSave } from "@/hooks/use-contract";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Trash2, Calendar, Code2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  const router = useRouter();
  const contracts = useContractsListStore((s) => s.contracts);
  const removeFromList = useContractsListStore((s) => s.remove);
  const createContract = useContractStore((s) => s.createContract);
  const save = useContractSave();

  function handleNew() {
    const contract = createContract("Untitled Contract");
    save();
    router.push(`/contract/${contract.id}`);
  }

  function handleOpen(id: string) {
    router.push(`/contract/${id}`);
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">API Contracts</h1>
            <p className="text-muted-foreground mt-1">
              Generate formal API contracts from JIRA stories and Figma screens.
            </p>
          </div>
          <Button onClick={handleNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Contract
          </Button>
        </div>

        {contracts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="text-lg font-medium">No contracts yet</p>
              <p className="text-muted-foreground text-sm mt-1">
                Create your first contract to start generating API contracts from JIRA stories.
              </p>
            </div>
            <Button onClick={handleNew} size="lg" className="gap-1.5 mt-2">
              <Plus className="h-5 w-5" /> Create First Contract
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contracts.map((c) => (
              <Card
                key={c.id}
                className="cursor-pointer hover:border-primary/50 transition-colors group"
                onClick={() => handleOpen(c.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base truncate">{c.name}</CardTitle>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Code2 className="h-3.5 w-3.5" />
                      {c.endpointCount} endpoint{c.endpointCount !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {c.screenCount} screen{c.screenCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="pt-2 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete contract?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{c.name}&quot;. This action cannot
                          be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => removeFromList(c.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            ))}

            {/* New contract card */}
            <Card
              className="cursor-pointer border-dashed hover:border-primary/50 hover:bg-muted/20 transition-colors flex items-center justify-center min-h-36"
              onClick={handleNew}
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Plus className="h-8 w-8" />
                <span className="text-sm font-medium">New Contract</span>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

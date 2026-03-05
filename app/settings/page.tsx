import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AISettingsForm } from "@/components/settings/ai-settings-form";
import { SpecManager } from "@/components/specs/spec-manager";
import { ThemeToggle } from "@/components/settings/theme-toggle";

export default function SettingsPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Toggle between light and dark mode.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <span className="text-sm">Theme</span>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Provider</CardTitle>
            <CardDescription>
              Configure Claude or OpenAI for automatic endpoint analysis. Keys are stored
              in localStorage only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AISettingsForm />
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Swagger Specs</CardTitle>
            <CardDescription>
              Load and cache API specs for naming convention reference and fuzzy endpoint
              matching.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SpecManager />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

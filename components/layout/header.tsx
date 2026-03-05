"use client";
import Link from "next/link";
import { FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/settings/theme-toggle";

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-14 items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <FileText className="h-5 w-5 text-primary" />
          <span>Contract Tool</span>
        </Link>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

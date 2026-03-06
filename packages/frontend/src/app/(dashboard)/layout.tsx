"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/layout/command-palette";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { DynamicBackground } from "@/components/layout/DynamicBackground";
import { PageTransition } from "@/components/shared/page-transition";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden relative">
      <DynamicBackground />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden bg-muted/50 dark:bg-muted/10 z-10 relative">
        <Topbar />
        <main className="flex-1 overflow-auto p-8 md:p-10">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

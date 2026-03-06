"use client";

import { DynamicBackground } from "@/components/layout/DynamicBackground";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <DynamicBackground />
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">ROSMAR CRM</h1>
          <p className="mt-2 text-sm text-muted-foreground tracking-tight">
            Web3-native customer relationship management
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

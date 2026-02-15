"use client";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import {
  LayoutDashboard,
  Users,
  Building2,
  Handshake,
  Filter,
  Megaphone,
  Ticket,
  Vault,
  BarChart3,
  Settings,
  ChevronLeft,
} from "lucide-react";
import { ThemeLogo } from "@/components/ui/theme-logo";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Profiles", href: "/profiles" },
  { icon: Building2, label: "Organizations", href: "/organizations" },
  { icon: Handshake, label: "Deals", href: "/deals" },
  { icon: Filter, label: "Segments", href: "/segments" },
  { icon: Megaphone, label: "Campaigns", href: "/campaigns" },
  { icon: Ticket, label: "Tickets", href: "/tickets" },
  { icon: Vault, label: "Vault", href: "/vault" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "relative flex h-full flex-col border-r bg-background transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        {!sidebarCollapsed ? (
          <Link href="/" className="flex items-center gap-2">
            <ThemeLogo width={28} height={28} />
            <span className="text-lg font-semibold text-sidebar-foreground">ROSMAR</span>
          </Link>
        ) : (
          <Link href="/" className="mx-auto">
            <ThemeLogo width={24} height={24} />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn("ml-auto", sidebarCollapsed && "mx-auto")}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              sidebarCollapsed && "rotate-180"
            )}
          />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 py-4">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    sidebarCollapsed && "justify-center px-2"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {!sidebarCollapsed && (
                    <span className="ml-3">{item.label}</span>
                  )}
                </Button>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}

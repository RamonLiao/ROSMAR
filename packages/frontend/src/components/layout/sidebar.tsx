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
  Radio,
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

const navGroups = [
  {
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/" },
      { icon: Users, label: "Profiles", href: "/profiles" },
      { icon: Building2, label: "Organizations", href: "/organizations" },
      { icon: Handshake, label: "Deals", href: "/deals" },
    ],
  },
  {
    items: [
      { icon: Filter, label: "Segments", href: "/segments" },
      { icon: Megaphone, label: "Campaigns", href: "/campaigns" },
      { icon: Radio, label: "Broadcasts", href: "/broadcasts" },
      { icon: Ticket, label: "Tickets", href: "/tickets" },
    ],
  },
  {
    items: [
      { icon: Vault, label: "Vault", href: "/vault" },
      { icon: BarChart3, label: "Analytics", href: "/analytics" },
      { icon: Settings, label: "Settings", href: "/settings/workspace" },
    ],
  },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "relative flex h-full flex-col bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-r border-border/40 shadow-xl transition-all duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center px-4 border-b border-border/40">
        {!sidebarCollapsed ? (
          <Link href="/" className="flex items-center gap-3">
            <ThemeLogo width={28} height={28} />
            <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">ROSMAR</span>
          </Link>
        ) : (
          <Link href="/" className="mx-auto mt-1">
            <ThemeLogo width={28} height={28} />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn("ml-auto transition-all duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]", sidebarCollapsed && "mx-auto")}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
              sidebarCollapsed && "rotate-180"
            )}
          />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 py-6">
        <nav className="flex flex-col">
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {groupIndex > 0 && (
                <div className="my-2 border-t border-white/5" />
              )}
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "relative w-full justify-start transition-all duration-200 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
                          "hover:bg-primary/5 hover:translate-x-0.5",
                          isActive && "bg-primary/10 hover:bg-primary/10",
                          sidebarCollapsed && "justify-center px-2"
                        )}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full bg-primary" />
                        )}
                        <item.icon className="h-4 w-4" />
                        {!sidebarCollapsed && (
                          <span className="ml-3">{item.label}</span>
                        )}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}

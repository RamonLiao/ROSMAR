"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useSwitchWorkspace, useCreateWorkspace } from "@/lib/hooks/use-workspaces";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, ChevronDown, Loader2, LogOut, Plus, Settings, User, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";
import { useDisconnectWallet } from "@mysten/dapp-kit";
import { useNotifications, useUnreadCount, useMarkRead, useMarkAllRead } from "@/lib/hooks/use-notifications";
import { resetSealInstances } from "@/lib/crypto/seal-crypto";

export function Topbar() {
  const router = useRouter();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const { logout } = useAuthStore();
  const { activeWorkspace, workspaces } = useWorkspaceStore();
  const resetWorkspace = useWorkspaceStore((s) => s.reset);

  const switchWorkspace = useSwitchWorkspace();
  const createWorkspace = useCreateWorkspace();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const { data: notifications } = useNotifications();
  const { data: unreadData } = useUnreadCount();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const unreadCount = unreadData?.count ?? 0;

  const handleSwitch = (workspace: { id: string; name: string }) => {
    if (workspace.id === activeWorkspace?.id) return;
    switchWorkspace.mutate(workspace);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    createWorkspace.mutate(
      { name: newName.trim() },
      {
        onSuccess: (data) => {
          // Auto-switch to the newly created workspace
          const ws = data.workspace;
          switchWorkspace.mutate({ id: ws.id, name: ws.name });
          setNewName("");
          setCreateOpen(false);
        },
      },
    );
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Best-effort server logout — clear local state regardless
    }
    resetSealInstances();
    disconnectWallet();
    logout();
    resetWorkspace();
    router.push("/login");
  };

  const isSwitching = switchWorkspace.isPending;

  // TODO: read profile name from user profile store when available
  const profileName = null as string | null;

  return (
    <div className="flex h-16 items-center justify-between border-b border-border/30 bg-background/80 backdrop-blur-xl shadow-sm px-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-64 justify-between transition-all duration-[200ms]" disabled={isSwitching}>
            {isSwitching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="truncate">
                {activeWorkspace?.name || "Select Workspace"}
              </span>
            )}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => handleSwitch(workspace)}
              className="flex items-center justify-between"
            >
              <span className="truncate">{workspace.name}</span>
              {workspace.id === activeWorkspace?.id && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Workspace
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings/workspace")}>
            <Settings className="mr-2 h-4 w-4" />
            Manage Workspaces
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative transition-all duration-[200ms]">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-medium">Notifications</p>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => markAllRead.mutate()}
                >
                  Mark all read
                </Button>
              )}
            </div>
            <ScrollArea className="max-h-72">
              {notifications && notifications.length > 0 ? (
                <div className="divide-y">
                  {notifications.map((n: any) => (
                    <div
                      key={n.id}
                      className={`flex flex-col gap-1 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        !n.isRead ? "bg-primary/5" : ""
                      }`}
                      onClick={() => !n.isRead && markRead.mutate(n.id)}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{n.title}</p>
                        {!n.isRead && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      {n.body && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  No notifications
                </div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full transition-all duration-[200ms]">
              <Avatar>
                <AvatarFallback className="bg-muted text-muted-foreground">
                  {profileName
                    ? profileName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
                    : <UserRound className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push("/settings/workspace")}>
              <User className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Workspace name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createWorkspace.isPending}>
              {createWorkspace.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

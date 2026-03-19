"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { AddressDisplay } from "@/components/shared/address-display";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import {
  useWorkspaceMembers,
  useAddMember,
  useRemoveMember,
  ROLE_LABELS,
  type WorkspaceMember,
} from "@/lib/hooks/use-workspaces";

const roleColors: Record<string, string> = {
  owner:
    "bg-teal-100 text-teal-700 border border-teal-200 dark:bg-primary/15 dark:text-primary dark:border-primary/30",
  admin:
    "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-400/30",
  member:
    "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-400/30",
  viewer:
    "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
};

// roleLevel → permissions defaults
const ROLE_DEFAULTS: Record<string, { roleLevel: number; permissions: number }> =
  {
    admin: { roleLevel: 2, permissions: 31 },
    member: { roleLevel: 1, permissions: 7 }, // READ | WRITE | SHARE
    viewer: { roleLevel: 0, permissions: 1 }, // READ
  };

export default function MembersSettingsPage() {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const workspaceId = activeWorkspace?.id ?? "";
  const { data, isLoading } = useWorkspaceMembers(workspaceId);
  const addMember = useAddMember();
  const removeMember = useRemoveMember();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newRole, setNewRole] = useState("member");

  const members = data?.members ?? [];

  const handleInvite = () => {
    if (!newAddress.trim() || !workspaceId) return;
    const defaults = ROLE_DEFAULTS[newRole] ?? ROLE_DEFAULTS.member;
    addMember.mutate(
      {
        workspaceId,
        address: newAddress.trim(),
        ...defaults,
      },
      {
        onSuccess: () => {
          setNewAddress("");
          setNewRole("member");
          setDialogOpen(false);
        },
      }
    );
  };

  const handleRemove = (address: string) => {
    if (!workspaceId) return;
    removeMember.mutate({ workspaceId, address });
  };

  const columns: { key: string; label: string; render?: (item: WorkspaceMember) => React.ReactNode }[] = [
    {
      key: "address",
      label: "Member",
      render: (item: WorkspaceMember) => (
        <AddressDisplay address={item.address} />
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (item: WorkspaceMember) => {
        const role = ROLE_LABELS[item.role_level] ?? "unknown";
        return (
          <Badge variant="outline" className={roleColors[role]}>
            {role}
          </Badge>
        );
      },
    },
    {
      key: "joined_at",
      label: "Joined",
      render: (item: WorkspaceMember) =>
        new Date(item.joined_at).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: WorkspaceMember) =>
        item.role_level < 3 ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => handleRemove(item.address)}
            disabled={removeMember.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Workspace Members
          </h1>
          <p className="text-muted-foreground tracking-tight">
            Manage team members and permissions
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="address">Wallet Address</Label>
                <Input
                  id="address"
                  placeholder="0x..."
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleInvite}
                disabled={!newAddress.trim() || addMember.isPending}
              >
                {addMember.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add Member
              </Button>
              {addMember.isError && (
                <p className="text-sm text-destructive">
                  {(addMember.error as Error).message}
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading members...
        </div>
      ) : (
        <DataTable
          data={members as (WorkspaceMember & Record<string, unknown>)[]}
          columns={columns as { key: string; label: string; render?: (item: WorkspaceMember & Record<string, unknown>) => React.ReactNode }[]}
          searchable
          searchPlaceholder="Search members..."
        />
      )}
    </div>
  );
}

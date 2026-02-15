"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { AddressDisplay } from "@/components/shared/address-display";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

const mockMembers = [
  {
    id: "1",
    address: "0x1234567890abcdef1234567890abcdef12345678",
    role: "owner",
    joined_at: "2026-01-01T10:00:00Z",
  },
  {
    id: "2",
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
    role: "admin",
    joined_at: "2026-01-15T14:30:00Z",
  },
  {
    id: "3",
    address: "0x7890abcdef1234567890abcdef1234567890abcd",
    role: "member",
    joined_at: "2026-02-05T09:15:00Z",
  },
  {
    id: "4",
    address: "0x4567890abcdef1234567890abcdef1234567890a",
    role: "viewer",
    joined_at: "2026-02-10T16:45:00Z",
  },
];

const roleColors: Record<string, string> = {
  owner: "bg-purple-600",
  admin: "bg-blue-500",
  member: "bg-green-500",
  viewer: "bg-gray-500",
};

export default function MembersSettingsPage() {
  const handleRoleChange = (memberId: string, newRole: string) => {
    console.log("Change role for member", memberId, "to", newRole);
  };

  const columns = [
    {
      key: "address",
      label: "Member",
      render: (item: typeof mockMembers[0]) => (
        <AddressDisplay address={item.address} />
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (item: typeof mockMembers[0]) => (
        <Badge className={roleColors[item.role]}>{item.role}</Badge>
      ),
    },
    {
      key: "joined_at",
      label: "Joined",
      render: (item: typeof mockMembers[0]) =>
        new Date(item.joined_at).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: typeof mockMembers[0]) =>
        item.role !== "owner" ? (
          <Select
            defaultValue={item.role}
            onValueChange={(value) => handleRoleChange(item.id, value)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workspace Members</h1>
          <p className="text-muted-foreground">
            Manage team members and permissions
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <DataTable
        data={mockMembers}
        columns={columns}
        searchable
        searchPlaceholder="Search members..."
      />
    </div>
  );
}

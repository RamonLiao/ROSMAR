"use client";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

const mockTickets = [
  {
    id: "1",
    title: "Cannot connect wallet",
    status: "open",
    priority: "high",
    assignee: "Support Team",
    sla_deadline: "2026-02-16T12:00:00Z",
    created_at: "2026-02-15T09:30:00Z",
  },
  {
    id: "2",
    title: "Transaction failed",
    status: "in_progress",
    priority: "critical",
    assignee: "Tech Team",
    sla_deadline: "2026-02-15T18:00:00Z",
    created_at: "2026-02-15T10:15:00Z",
  },
  {
    id: "3",
    title: "Feature request: Dark mode",
    status: "waiting",
    priority: "low",
    assignee: "Product Team",
    sla_deadline: "2026-02-20T12:00:00Z",
    created_at: "2026-02-14T14:20:00Z",
  },
  {
    id: "4",
    title: "Profile update issue",
    status: "resolved",
    priority: "medium",
    assignee: "Support Team",
    sla_deadline: "2026-02-15T10:00:00Z",
    created_at: "2026-02-14T08:00:00Z",
  },
];

const statusColors: Record<string, string> = {
  open: "bg-blue-500",
  in_progress: "bg-yellow-500",
  waiting: "bg-purple-500",
  resolved: "bg-green-500",
  closed: "bg-gray-500",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-blue-400",
  high: "bg-orange-500",
  critical: "bg-red-600",
};

export default function TicketsPage() {
  const columns = [
    {
      key: "title",
      label: "Title",
      render: (item: typeof mockTickets[0]) => (
        <span className="font-medium">{item.title}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: typeof mockTickets[0]) => (
        <Badge className={statusColors[item.status]}>{item.status}</Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (item: typeof mockTickets[0]) => (
        <Badge className={priorityColors[item.priority]}>{item.priority}</Badge>
      ),
    },
    {
      key: "assignee",
      label: "Assignee",
    },
    {
      key: "sla_deadline",
      label: "SLA Deadline",
      render: (item: typeof mockTickets[0]) => {
        const deadline = new Date(item.sla_deadline);
        const now = new Date();
        const isOverdue = deadline < now;
        return (
          <span className={isOverdue ? "text-red-600 font-medium" : ""}>
            {deadline.toLocaleDateString()} {deadline.toLocaleTimeString()}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: () => (
        <Button variant="outline" size="sm">
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tickets</h1>
          <p className="text-muted-foreground">
            Support ticket management with SLA tracking
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </div>

      <DataTable
        data={mockTickets}
        columns={columns}
        searchable
        searchPlaceholder="Search tickets..."
      />
    </div>
  );
}

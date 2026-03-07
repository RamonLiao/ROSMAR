"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

function truncateAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const ACTION_COLORS: Record<string, string> = {
  create: "default",
  read: "secondary",
  update: "outline",
  delete: "destructive",
};

export function VaultAuditLog({
  profileId,
  secretKey,
}: {
  profileId: string;
  secretKey: string;
}) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.get<{ logs: AuditLogEntry[] }>(
        `/vault/secrets/${profileId}/${secretKey}/audit`,
      );
      setLogs(data.logs);
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        disabled={loading}
        className="text-xs gap-1"
      >
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {loading ? "Loading..." : "Audit Log"}
      </Button>

      {expanded && logs.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Actor</TableHead>
              <TableHead className="text-xs">Action</TableHead>
              <TableHead className="text-xs">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs font-mono">
                  {truncateAddress(log.actor)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      (ACTION_COLORS[log.action] as "default" | "secondary" | "outline" | "destructive") ?? "default"
                    }
                    className="text-xs"
                  >
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {expanded && logs.length === 0 && (
        <p className="text-xs text-muted-foreground px-2 py-1">
          No audit logs found.
        </p>
      )}
    </div>
  );
}

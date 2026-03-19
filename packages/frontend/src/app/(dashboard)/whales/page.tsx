"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Fish, Plus, Save, Trash2, Loader2 } from "lucide-react";
import {
  useWhaleThresholds,
  useSetWhaleThresholds,
  useWhaleAlerts,
  useTopWhales,
  type WhaleThreshold,
} from "@/lib/hooks/use-whales";

function truncateAddress(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

/* ── Section A: Threshold Config ── */
function ThresholdConfig() {
  const { data: thresholds = [], isLoading } = useWhaleThresholds();
  const setThresholds = useSetWhaleThresholds();
  const [draft, setDraft] = useState<WhaleThreshold[] | null>(null);

  const rows = draft ?? thresholds;
  const isDirty = draft !== null;

  const updateRow = (idx: number, field: keyof WhaleThreshold, value: string) => {
    const next = [...rows];
    if (field === "amount") {
      next[idx] = { ...next[idx], amount: parseFloat(value) || 0 };
    } else {
      next[idx] = { ...next[idx], [field]: value };
    }
    setDraft(next);
  };

  const addRow = () => {
    setDraft([...rows, { token: "", amount: 0 }]);
  };

  const removeRow = (idx: number) => {
    setDraft(rows.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!draft) return;
    const valid = draft.filter((t) => t.token.trim() && t.amount > 0);
    setThresholds.mutate(valid, {
      onSuccess: () => setDraft(null),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Whale Thresholds</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Whale Thresholds</CardTitle>
            <CardDescription>
              Transactions exceeding these amounts trigger whale alerts
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
            {isDirty && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={setThresholds.isPending}
              >
                {setThresholds.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No thresholds configured. Click &quot;Add&quot; to create one.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Threshold Amount</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input
                      value={row.token}
                      onChange={(e) => updateRow(idx, "token", e.target.value)}
                      placeholder="SUI"
                      className="h-8 w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={row.amount || ""}
                      onChange={(e) => updateRow(idx, "amount", e.target.value)}
                      placeholder="10000"
                      className="h-8 w-40"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeRow(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Section B: Recent Whale Alerts ── */
function RecentWhaleAlerts() {
  const [limit, setLimit] = useState(50);
  const { data: alerts = [], isLoading } = useWhaleAlerts(limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Whale Alerts</CardTitle>
        <CardDescription>
          Large transactions detected by threshold rules or the indexer
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No whale alerts yet
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(alert.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {truncateAddress(alert.metadata?.address ?? "")}
                    </TableCell>
                    <TableCell className="font-medium text-amber-600 dark:text-amber-400">
                      {alert.metadata?.amount
                        ? formatAmount(alert.metadata.amount)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{alert.metadata?.token ?? "-"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {alert.metadata?.txType ?? "-"}
                    </TableCell>
                    <TableCell>
                      {alert.metadata?.profileId ? (
                        <Link
                          href={`/profiles/${alert.metadata.profileId}`}
                          className="text-primary hover:underline text-sm"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {alerts.length >= limit && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLimit((l) => l + 50)}
                >
                  Load More
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Section C: Top Whale Profiles ── */
function TopWhaleProfiles() {
  const { data: whales = [], isLoading } = useTopWhales(20);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Whale Profiles</CardTitle>
        <CardDescription>
          Profiles ranked by total token balance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : whales.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No wallet balance data available
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Total Balance (raw)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {whales.map((whale, idx) => (
                <TableRow key={whale.profileId}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <Link
                      href={`/profiles/${whale.profileId}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {whale.suinsName ?? truncateAddress(whale.primaryAddress)}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {truncateAddress(whale.primaryAddress)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {whale.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatAmount(Number(whale.totalRawBalance))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main Page ── */
export default function WhalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Fish className="h-7 w-7 text-amber-500" />
          <h1 className="text-3xl font-semibold tracking-tight">Whales</h1>
        </div>
        <p className="text-muted-foreground tracking-tight mt-1">
          Monitor large holders and high-value transactions
        </p>
      </div>

      <ThresholdConfig />
      <RecentWhaleAlerts />
      <TopWhaleProfiles />
    </div>
  );
}

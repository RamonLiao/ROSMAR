"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RuleBuilder } from "@/components/segment/rule-builder";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreateSegment } from "@/lib/hooks/use-segments";

export default function NewSegmentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const createSegment = useCreateSegment();

  const handleSave = () => {
    if (!name.trim()) return;
    createSegment.mutate(
      { name, rules: {} },
      { onSuccess: () => router.push("/segments") }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Create Segment</h1>
          <p className="text-muted-foreground">
            Define rules to automatically segment your profiles
          </p>
        </div>
        <Button onClick={handleSave} disabled={createSegment.isPending || !name.trim()}>
          {createSegment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Segment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Segment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Segment Name</Label>
            <Input
              id="name"
              placeholder="e.g., Whale Collectors"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segmentation Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <RuleBuilder />
        </CardContent>
      </Card>
    </div>
  );
}

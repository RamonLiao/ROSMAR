"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkflowCanvas } from "@/components/campaign/workflow-canvas";
import { ArrowLeft, Save } from "lucide-react";
import { useRouter } from "next/navigation";

export default function WorkflowEditorPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();

  const handleSave = () => {
    // TODO: Save workflow via API
    console.log("Save workflow for campaign", params.id);
    router.push(`/campaigns/${params.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Workflow Editor</h1>
          <p className="text-muted-foreground">
            Design your campaign automation flow
          </p>
        </div>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Workflow
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Canvas</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkflowCanvas />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Button variant="outline" size="sm">
              Send Telegram
            </Button>
            <Button variant="outline" size="sm">
              Send Discord
            </Button>
            <Button variant="outline" size="sm">
              Send Email
            </Button>
            <Button variant="outline" size="sm">
              Airdrop Token
            </Button>
            <Button variant="outline" size="sm">
              Add to Segment
            </Button>
            <Button variant="outline" size="sm">
              Update Tier
            </Button>
            <Button variant="outline" size="sm">
              Wait Delay
            </Button>
            <Button variant="outline" size="sm">
              Condition
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import { useState } from "react";

export default function WorkspaceSettingsPage() {
  const [name, setName] = useState("My Workspace");
  const [description, setDescription] = useState(
    "Primary workspace for customer management"
  );

  const handleSave = () => {
    console.log("Save workspace settings:", { name, description });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workspace Settings</h1>
        <p className="text-muted-foreground">
          Manage your workspace configuration
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engagement Score Weights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>NFT Transfers</Label>
              <Input type="number" defaultValue="10" />
            </div>
            <div className="space-y-2">
              <Label>Token Swaps</Label>
              <Input type="number" defaultValue="5" />
            </div>
            <div className="space-y-2">
              <Label>Staking</Label>
              <Input type="number" defaultValue="15" />
            </div>
            <div className="space-y-2">
              <Label>Contract Interactions</Label>
              <Input type="number" defaultValue="8" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

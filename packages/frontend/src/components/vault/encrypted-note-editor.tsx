"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Save } from "lucide-react";

export function EncryptedNoteEditor() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Client-side encryption with Seal
    // 1. Encrypt content
    // 2. Upload encrypted blob to BFF → Walrus
    // 3. Store policy on-chain
    console.log("Encrypting and saving note:", { title, content });

    setTimeout(() => {
      setIsSaving(false);
      setTitle("");
      setContent("");
    }, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Encrypted Note
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Note title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            placeholder="Write your encrypted note here..."
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="text-muted-foreground">
            <Lock className="mr-2 inline h-3 w-3" />
            This note will be encrypted client-side using Seal before uploading.
            Only you can decrypt it with your private key.
          </p>
        </div>

        <Button onClick={handleSave} disabled={!title || !content || isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Encrypting..." : "Save Encrypted Note"}
        </Button>
      </CardContent>
    </Card>
  );
}

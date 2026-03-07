"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

interface Props {
  dealId: string;
  onUpload: (data: {
    name: string;
    encryptedData: string;
    mimeType?: string;
    fileSize?: number;
  }) => Promise<void>;
  isLoading: boolean;
}

export function DocumentUploadForm({ dealId, onUpload, isLoading }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError("File too large (max 5 MB)");
      return;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    // Base64 encode (in production, Seal encrypt before encoding)
    const encryptedData = btoa(
      String.fromCharCode.apply(null, Array.from(bytes)),
    );

    await onUpload({
      name: file.name,
      encryptedData,
      mimeType: file.type || undefined,
      fileSize: file.size,
    });

    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <Label>Select File</Label>
      <Input
        ref={fileRef}
        type="file"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setError("");
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleSubmit} disabled={!file || isLoading} size="sm">
        <Upload className="mr-2 h-4 w-4" />
        {isLoading ? "Uploading..." : "Encrypt & Upload"}
      </Button>
    </div>
  );
}

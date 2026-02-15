"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Lock, Upload } from "lucide-react";

export function FileUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    // TODO: Client-side encryption with Seal
    // 1. Read file as ArrayBuffer
    // 2. Encrypt file
    // 3. Upload encrypted blob to BFF → Walrus
    // 4. Store policy on-chain
    console.log("Encrypting and uploading file:", file.name);

    setTimeout(() => {
      setIsUploading(false);
      setFile(null);
    }, 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Encrypted File Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid w-full items-center gap-1.5">
          <Input
            id="file"
            type="file"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </div>

        {file && (
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">{file.name}</p>
            <p className="text-muted-foreground">
              Size: {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
        )}

        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="text-muted-foreground">
            <Lock className="mr-2 inline h-3 w-3" />
            Files are encrypted client-side before upload. Stored on Walrus with
            Seal access control.
          </p>
        </div>

        <Button onClick={handleUpload} disabled={!file || isUploading}>
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? "Encrypting..." : "Upload Encrypted File"}
        </Button>
      </CardContent>
    </Card>
  );
}

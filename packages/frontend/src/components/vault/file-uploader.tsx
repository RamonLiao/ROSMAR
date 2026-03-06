"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Lock, Upload } from "lucide-react";
import { useVaultCrypto } from "@/lib/hooks/use-vault-crypto";

interface FileUploaderProps {
  profileId?: string;
  sealPolicyId?: string;
  onUploaded?: () => void;
}

export function FileUploader({
  profileId,
  sealPolicyId: defaultPolicyId,
  onUploaded,
}: FileUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [policyType, setPolicyType] = useState<string>("workspace");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { encryptAndStore, isInitializing } = useVaultCrypto();

  const policyObjectId = defaultPolicyId ?? "0x0";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file || !profileId) return;

    setIsUploading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const plaintext = new Uint8Array(buffer);

      await encryptAndStore({
        profileId,
        key: `file:${file.name}`,
        plaintext,
        sealPolicyId: policyObjectId,
      });

      setFile(null);
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Encryption failed");
    } finally {
      setIsUploading(false);
    }
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

        <div className="space-y-2">
          <Label htmlFor="file-policy-type">Access Policy</Label>
          <Select value={policyType} onValueChange={setPolicyType}>
            <SelectTrigger id="file-policy-type">
              <SelectValue placeholder="Select policy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="workspace">Workspace Members</SelectItem>
              <SelectItem value="address">Specific Addresses</SelectItem>
              <SelectItem value="role">Role-Based</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="text-muted-foreground">
            <Lock className="mr-2 inline h-3 w-3" />
            Files are encrypted client-side before upload. Stored on Walrus with
            Seal access control.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          onClick={handleUpload}
          disabled={!file || isUploading || isInitializing}
        >
          <Upload className="mr-2 h-4 w-4" />
          {isInitializing
            ? "Initializing session..."
            : isUploading
              ? "Encrypting..."
              : "Upload Encrypted File"}
        </Button>
      </CardContent>
    </Card>
  );
}

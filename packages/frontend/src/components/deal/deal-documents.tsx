"use client";

import {
  useDealDocuments,
  useUploadDealDocument,
  useDeleteDealDocument,
} from "@/lib/hooks/use-deal-documents";
import { DocumentUploadForm } from "./document-upload-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileIcon, Trash2, Lock } from "lucide-react";
import { useState } from "react";

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DealDocuments({
  dealId,
  workspaceId,
}: {
  dealId: string;
  workspaceId: string;
}) {
  const { data: documents = [], isLoading } = useDealDocuments(dealId);
  const upload = useUploadDealDocument(dealId);
  const deleteMut = useDeleteDealDocument(dealId);
  const [showUpload, setShowUpload] = useState(false);

  if (isLoading) return <div className="animate-pulse h-32" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Documents</h3>
        <Button onClick={() => setShowUpload(!showUpload)} size="sm">
          Upload Document
        </Button>
      </div>

      {showUpload && (
        <DocumentUploadForm
          dealId={dealId}
          onUpload={async (data) => {
            await upload.mutateAsync(data);
            setShowUpload(false);
          }}
          isLoading={upload.isPending}
        />
      )}

      {(documents as any[]).length === 0 ? (
        <p className="text-muted-foreground text-sm">No documents yet.</p>
      ) : (
        <div className="grid gap-3">
          {(documents as any[]).map((doc: any) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.fileSize)}
                      {doc.fileSize ? " · " : ""}
                      {formatRelativeTime(doc.createdAt)}
                    </p>
                  </div>
                  {doc.sealPolicyId && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Lock className="h-3 w-3 text-amber-500" />
                      Encrypted
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      deleteMut.mutate({
                        docId: doc.id,
                        version: doc.version,
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

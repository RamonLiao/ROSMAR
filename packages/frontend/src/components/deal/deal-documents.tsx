"use client";

import {
  useDealDocuments,
  useUploadDealDocument,
  useDeleteDealDocument,
  useUpdateDocumentPolicy,
  type DealDocument,
} from "@/lib/hooks/use-deal-documents";
import { DocumentUploadForm } from "./document-upload-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileIcon, Trash2, Lock, ShieldAlert, Shield } from "lucide-react";
import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useAuthStore } from "@/stores/auth-store";
import { PolicySelector, type PolicyValue } from "@/components/vault/policy-selector";

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

function PolicyBadge({ doc }: { doc: DealDocument }) {
  if (!doc.sealPolicyId) return null;
  return (
    <Badge variant="outline" className="text-xs gap-1">
      <Lock className="h-3 w-3 text-amber-500" />
      Encrypted
    </Badge>
  );
}

export function DealDocuments({
  dealId,
  workspaceId,
  allowedAddresses,
}: {
  dealId: string;
  workspaceId: string;
  /** Explicit allow-list of wallet addresses (e.g. payer + payee).
   *  Falls back to authenticated session address when omitted. */
  allowedAddresses?: string[];
}) {
  const currentAccount = useCurrentAccount();
  const userAddress = useAuthStore((s) => s.userAddress);

  // Seal-style access gate
  const isAuthorized: boolean = (() => {
    const connectedAddress = currentAccount?.address ?? null;
    if (!connectedAddress) return false;

    if (allowedAddresses && allowedAddresses.length > 0) {
      return allowedAddresses.includes(connectedAddress);
    }

    return !!userAddress && connectedAddress === userAddress;
  })();

  const { data: documents = [], isLoading } = useDealDocuments(dealId);
  const upload = useUploadDealDocument(dealId);
  const deleteMut = useDeleteDealDocument(dealId);
  const updatePolicy = useUpdateDocumentPolicy(dealId);
  const [showUpload, setShowUpload] = useState(false);

  // Edit policy dialog state
  const [editingDoc, setEditingDoc] = useState<DealDocument | null>(null);
  const [editPolicy, setEditPolicy] = useState<PolicyValue>({ ruleType: 0 });

  const handleSavePolicy = async () => {
    if (!editingDoc) return;
    await updatePolicy.mutateAsync({
      docId: editingDoc.id,
      policy: editPolicy,
    });
    setEditingDoc(null);
  };

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Access Denied</h3>
        <p className="text-muted-foreground mt-2 text-sm max-w-xs">
          {currentAccount
            ? "Your connected wallet is not authorized to view documents for this deal."
            : "Connect your wallet to access deal documents."}
        </p>
      </div>
    );
  }

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

      {(documents as DealDocument[]).length === 0 ? (
        <p className="text-muted-foreground text-sm">No documents yet.</p>
      ) : (
        <div className="grid gap-3">
          {(documents as DealDocument[]).map((doc) => (
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
                  <PolicyBadge doc={doc} />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Edit access policy"
                    onClick={() => {
                      setEditPolicy({ ruleType: 0 });
                      setEditingDoc(doc);
                    }}
                  >
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </Button>
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

      {/* Edit Policy Dialog */}
      <Dialog
        open={!!editingDoc}
        onOpenChange={(open) => {
          if (!open) setEditingDoc(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Access Policy: {editingDoc?.name}
            </DialogTitle>
          </DialogHeader>
          <PolicySelector value={editPolicy} onChange={setEditPolicy} />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingDoc(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePolicy}
              disabled={updatePolicy.isPending}
            >
              {updatePolicy.isPending ? "Saving..." : "Save Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

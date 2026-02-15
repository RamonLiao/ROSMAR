"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EncryptedNoteEditor } from "@/components/vault/encrypted-note-editor";
import { FileUploader } from "@/components/vault/file-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function VaultPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Vault</h1>
        <p className="text-muted-foreground">
          Encrypted notes and files with client-side encryption
        </p>
      </div>

      <Tabs defaultValue="notes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <EncryptedNoteEditor />
            <Card>
              <CardHeader>
                <CardTitle>Saved Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">No encrypted notes yet</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <FileUploader />
            <Card>
              <CardHeader>
                <CardTitle>Uploaded Files</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">No encrypted files yet</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  Upload,
  Trash2,
  Clock,
  Fingerprint,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function CertificatesForm() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [uploadName, setUploadName] = useState("server");
  const [certPem, setCertPem] = useState("");
  const [keyPem, setKeyPem] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: certs, isLoading } = useQuery({
    queryKey: ["certificates"],
    queryFn: api.listCertificates,
    staleTime: 30_000,
  });

  const uploadMutation = useMutation({
    mutationFn: (data: { name: string; cert: string; key: string }) =>
      api.uploadCertificate(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      toast(
        `Certificate "${result.name}" uploaded${result.fingerprint ? ` (${result.fingerprint.slice(0, 20)}...)` : ""}`,
        "success",
      );
      setCertPem("");
      setKeyPem("");
    },
    onError: (error: Error) => {
      toast(error.message, "error");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.deleteCertificate(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      toast("Certificate removed", "success");
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast(error.message, "error");
    },
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!certPem.trim() || !keyPem.trim()) {
      toast("Both certificate and key are required", "error");
      return;
    }
    uploadMutation.mutate({ name: uploadName, cert: certPem, key: keyPem });
  };

  const certificates = certs?.certificates ?? [];

  return (
    <div className="space-y-6">
      {/* Existing certificates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            TLS Certificates
          </CardTitle>
          <CardDescription>
            Manage TLS certificates for server, CDN, and management API listeners.
            Upload production certificates to replace the auto-generated self-signed cert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading certificates...</p>
          ) : certificates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No certificates uploaded. The server is using an auto-generated self-signed certificate.
            </p>
          ) : (
            <div className="space-y-3">
              {certificates.map((cert) => {
                const isExpired =
                  cert.not_after && new Date(cert.not_after) < new Date();

                return (
                  <div
                    key={cert.name}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cert.name}</span>
                        {isExpired && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {cert.fingerprint && (
                          <span className="flex items-center gap-1">
                            <Fingerprint className="h-3 w-3" />
                            {cert.fingerprint.slice(0, 23)}...
                          </span>
                        )}
                        {cert.not_after && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires: {new Date(cert.not_after).toLocaleDateString()}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Upload className="h-3 w-3" />
                          {new Date(cert.uploaded_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(cert.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Upload Certificate</CardTitle>
          <CardDescription>
            Paste the PEM-encoded certificate and private key. Changes take effect
            immediately via hot-reload (no server restart needed).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="cert-name">Name</Label>
              <Input
                id="cert-name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="server"
              />
              <p className="text-xs text-muted-foreground">
                Use &quot;server&quot; for the main listener, &quot;cdn&quot; for CDN, or &quot;mgmt&quot; for the management API.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cert-pem">Certificate (PEM)</Label>
              <textarea
                id="cert-pem"
                value={certPem}
                onChange={(e) => setCertPem(e.target.value)}
                rows={4}
                placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="key-pem">Private Key (PEM)</Label>
              <textarea
                id="key-pem"
                value={keyPem}
                onChange={(e) => setKeyPem(e.target.value)}
                rows={4}
                placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
            </div>

            <Button type="submit" disabled={uploadMutation.isPending}>
              <Upload className="h-3.5 w-3.5" />
              {uploadMutation.isPending ? "Uploading..." : "Upload Certificate"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Certificate"
        description={`Remove the "${deleteTarget}" certificate? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

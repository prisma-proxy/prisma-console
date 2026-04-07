"use client";

import { useState, useMemo } from "react";
import { Archive, Plus, Save, Search, HardDrive, Timer } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBackups, useCreateBackup, useRestoreBackup, useDeleteBackup, useBackupDiff } from "@/hooks/use-backups";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BackupTable } from "@/components/backups/backup-table";
import { BackupCompare } from "@/components/backups/backup-compare";
import { DiffViewer } from "@/components/backups/diff-viewer";
import { RestoreDialog } from "@/components/backups/restore-dialog";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/loading-placeholder";
import { useToast } from "@/lib/toast-context";

export default function BackupsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: backups, isLoading } = useBackups();
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();
  const deleteBackup = useDeleteBackup();

  const [restoreName, setRestoreName] = useState<string | null>(null);
  const [diffName, setDiffName] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-backup interval config
  const { data: config } = useQuery({
    queryKey: ["config"],
    queryFn: api.getConfig,
  });
  const [intervalInput, setIntervalInput] = useState<string | null>(null);
  const displayInterval = intervalInput ?? String(config?.auto_backup_interval_mins ?? "");

  const patchConfig = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patchConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      setIntervalInput(null);
      toast(t("toast.settingsSaved"), "success");
    },
    onError: (error: Error) => {
      toast(error.message, "error");
    },
  });

  const handleSaveInterval = () => {
    const mins = parseInt(displayInterval, 10);
    if (!isNaN(mins) && mins >= 0) {
      patchConfig.mutate({ auto_backup_interval_mins: mins });
    }
  };

  // Header stats
  const totalCount = backups?.length ?? 0;
  const totalSize = useMemo(
    () => (backups ?? []).reduce((sum, b) => sum + b.size, 0),
    [backups],
  );

  // Search filter
  const filteredBackups = useMemo(() => {
    if (!backups) return [];
    if (!searchQuery.trim()) return backups;
    const q = searchQuery.toLowerCase();
    return backups.filter((b) => b.name.toLowerCase().includes(q));
  }, [backups, searchQuery]);

  const { data: diffData, isLoading: diffLoading } = useBackupDiff(diffName);

  const handleRestore = (name: string) => {
    setRestoreName(name);
  };

  const handleConfirmRestore = () => {
    if (restoreName) {
      restoreBackup.mutate(restoreName, {
        onSuccess: () => setRestoreName(null),
      });
    }
  };

  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);

  const handleDelete = (name: string) => {
    setConfirmDeleteName(name);
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteName) {
      setDeletingName(confirmDeleteName);
      deleteBackup.mutate(confirmDeleteName, {
        onSettled: () => {
          setDeletingName(null);
          setConfirmDeleteName(null);
        },
      });
    }
  };

  const handleBatchDelete = (names: string[]) => {
    names.forEach((name) => deleteBackup.mutate(name));
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{t("backups.title")}</h2>
          {!isLoading && totalCount > 0 && (
            <>
              <Badge variant="secondary">
                <Archive className="h-3 w-3" data-icon="inline-start" />
                {totalCount}
              </Badge>
              <Badge variant="secondary">
                <HardDrive className="h-3 w-3" data-icon="inline-start" />
                {formatBytes(totalSize)}
              </Badge>
            </>
          )}
        </div>
        <Button
          onClick={() => createBackup.mutate()}
          disabled={createBackup.isPending}
        >
          <Plus className="h-4 w-4" data-icon="inline-start" />
          {createBackup.isPending ? t("backups.creating") : t("backups.create")}
        </Button>
      </div>

      {/* Auto-backup interval config */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
            <label className="text-sm font-medium whitespace-nowrap">
              {t("backups.autoBackupInterval")}
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                className="w-24 h-8 text-sm"
                value={displayInterval}
                onChange={(e) => setIntervalInput(e.target.value)}
                placeholder="0"
              />
              <span className="text-sm text-muted-foreground">{t("backups.minutes")}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveInterval}
              disabled={patchConfig.isPending || displayInterval === String(config?.auto_backup_interval_mins ?? "")}
            >
              <Save className="h-3.5 w-3.5" data-icon="inline-start" />
              {t("common.save")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("backups.autoBackupHint")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("backups.title")}</CardTitle>
            {(backups?.length ?? 0) > 0 && (
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t("backups.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <SkeletonTable rows={3} />
          ) : (backups?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Archive}
              title={t("empty.noBackups")}
              description={t("empty.noBackupsHint")}
              action={
                <Button
                  size="sm"
                  onClick={() => createBackup.mutate()}
                  disabled={createBackup.isPending}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t("backups.create")}
                </Button>
              }
            />
          ) : filteredBackups.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("backups.noSearchResults")}
            </p>
          ) : (
            <BackupTable
              backups={filteredBackups}
              onRestore={handleRestore}
              onDiff={(name) => setDiffName(name)}
              onDelete={handleDelete}
              onBatchDelete={handleBatchDelete}
              deletingName={deletingName}
            />
          )}
        </CardContent>
      </Card>

      {/* Backup comparison */}
      {(backups?.length ?? 0) >= 2 && (
        <BackupCompare backups={backups ?? []} />
      )}

      {/* Restore confirmation dialog */}
      <RestoreDialog
        open={restoreName !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreName(null);
        }}
        backupName={restoreName ?? ""}
        backups={backups ?? []}
        onConfirm={handleConfirmRestore}
        isPending={restoreBackup.isPending}
      />

      {/* Diff viewer dialog */}
      <DiffViewer
        open={diffName !== null}
        onOpenChange={(open) => {
          if (!open) setDiffName(null);
        }}
        backupName={diffName ?? ""}
        diff={diffData}
        isLoading={diffLoading}
      />

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={confirmDeleteName !== null}
        onOpenChange={(open) => { if (!open) setConfirmDeleteName(null); }}
        title={t("common.delete")}
        description={t("backups.deleteConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="destructive"
        onConfirm={handleConfirmDelete}
        isPending={deleteBackup.isPending}
      />
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast-context";
import { formatBytes } from "@/lib/utils";
import type { BackupInfo } from "@/lib/types";
import { RotateCcw, FileDiff, Trash2, Download, ArrowUp, ArrowDown } from "lucide-react";
import { api } from "@/lib/api";
import { downloadFile } from "@/lib/export";

interface BackupTableProps {
  backups: BackupInfo[];
  onRestore: (name: string) => void;
  onDiff: (name: string) => void;
  onDelete: (name: string) => void;
  onBatchDelete?: (names: string[]) => void;
  deletingName?: string | null;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function getBackupType(name: string): "auto" | "manual" {
  return name.startsWith("auto_") ? "auto" : "manual";
}

type SortField = "name" | "timestamp" | "size" | "type";
type SortDirection = "asc" | "desc";

export function BackupTable({
  backups,
  onRestore,
  onDiff,
  onDelete,
  onBatchDelete,
  deletingName,
}: BackupTableProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "timestamp" ? "desc" : "asc");
    }
  }

  const sortedBackups = useMemo(() => {
    const sorted = [...backups].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "timestamp":
          cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case "size":
          cmp = a.size - b.size;
          break;
        case "type": {
          const typeA = getBackupType(a.name);
          const typeB = getBackupType(b.name);
          cmp = typeA.localeCompare(typeB);
          break;
        }
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [backups, sortField, sortDirection]);

  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === backups.length
        ? new Set()
        : new Set(backups.map((b) => b.name))
    );
  }

  function handleBatchDelete() {
    if (onBatchDelete) onBatchDelete(Array.from(selected));
    setSelected(new Set());
    setBatchConfirmOpen(false);
  }

  async function handleDownload(name: string) {
    try {
      const content = await api.getBackup(name);
      const filename = name.endsWith(".toml") ? name : `${name}.toml`;
      downloadFile(content, filename, "application/toml");
    } catch {
      toast(t("toast.downloadError"), "error");
    }
  }

  if (backups.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("backups.noBackups")}
      </p>
    );
  }

  const allSelected = selected.size === backups.length;

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ArrowUp className="inline h-3 w-3 ml-1" />
    ) : (
      <ArrowDown className="inline h-3 w-3 ml-1" />
    );
  }

  const sortableHeader = (field: SortField, label: string) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      {label}
      <SortIcon field={field} />
    </TableHead>
  );

  return (
    <>
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-1">
          <span className="text-sm text-muted-foreground">
            {t("common.selectedCount", { count: selected.size })}
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBatchConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" data-icon="inline-start" />
            {t("common.deleteSelected", { count: selected.size })}
          </Button>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="rounded"
                aria-label="Select all"
              />
            </TableHead>
            {sortableHeader("name", t("backups.name"))}
            {sortableHeader("type", t("backups.type"))}
            {sortableHeader("timestamp", t("backups.timestamp"))}
            {sortableHeader("size", t("backups.size"))}
            <TableHead className="text-right">{t("backups.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedBackups.map((backup) => {
            const backupType = getBackupType(backup.name);
            return (
              <TableRow key={backup.name} data-state={selected.has(backup.name) ? "selected" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selected.has(backup.name)}
                    onChange={() => toggleSelect(backup.name)}
                    className="rounded"
                    aria-label={`Select ${backup.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{backup.name}</TableCell>
                <TableCell>
                  {backupType === "auto" ? (
                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      {t("backups.typeAuto")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                      {t("backups.typeManual")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex flex-col">
                    <span className="text-sm">{formatTimestamp(backup.timestamp)}</span>
                    <span className="text-xs text-muted-foreground/70">{formatRelativeTime(backup.timestamp)}</span>
                  </div>
                </TableCell>
                <TableCell>{formatBytes(backup.size)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(backup.name)}
                    >
                      <Download className="h-3.5 w-3.5" data-icon="inline-start" />
                      {t("backups.download")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRestore(backup.name)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" data-icon="inline-start" />
                      {t("backups.restore")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDiff(backup.name)}
                    >
                      <FileDiff className="h-3.5 w-3.5" data-icon="inline-start" />
                      {t("backups.diff")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(backup.name)}
                      disabled={deletingName === backup.name}
                    >
                      <Trash2 className="h-3.5 w-3.5" data-icon="inline-start" />
                      {deletingName === backup.name
                        ? t("backups.deleting")
                        : t("backups.delete")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={batchConfirmOpen}
        onOpenChange={(open) => { if (!open) setBatchConfirmOpen(false); }}
        title={t("common.delete")}
        description={t("backups.deleteBatchConfirm", { count: selected.size })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        variant="destructive"
        onConfirm={handleBatchDelete}
      />
    </>
  );
}

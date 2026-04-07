"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useBackupDiff } from "@/hooks/use-backups";
import { formatBytes, cn } from "@/lib/utils";
import { highlightToml } from "@/lib/toml-highlight";
import type { BackupInfo } from "@/lib/types";

interface RestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backupName: string;
  backups?: BackupInfo[];
  onConfirm: () => void;
  isPending?: boolean;
}

export function RestoreDialog({
  open,
  onOpenChange,
  backupName,
  backups = [],
  onConfirm,
  isPending,
}: RestoreDialogProps) {
  const { t } = useI18n();
  const [diffExpanded, setDiffExpanded] = useState(false);

  // Auto-fetch diff when dialog is open
  const { data: diffData, isLoading: diffLoading } = useBackupDiff(open ? backupName : null);

  const backupInfo = useMemo(
    () => backups.find((b) => b.name === backupName),
    [backups, backupName],
  );

  const summary = useMemo(() => {
    if (!diffData) return null;
    const added = diffData.changes.filter((c) => c.tag === "insert").length;
    const removed = diffData.changes.filter((c) => c.tag === "delete").length;
    return { added, removed };
  }, [diffData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("backups.restoreTitle")}</DialogTitle>
          <DialogDescription>
            {t("backups.restoreConfirm")}
          </DialogDescription>
        </DialogHeader>

        {/* Backup info */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
          <p className="text-sm font-mono">{backupName}</p>
          {backupInfo && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{new Date(backupInfo.timestamp).toLocaleString()}</span>
              <span>{formatBytes(backupInfo.size)}</span>
            </div>
          )}
        </div>

        {/* Diff preview */}
        {diffLoading && (
          <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
        )}
        {summary && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600 dark:text-green-400">+{summary.added} {t("backups.added")}</span>
                {", "}
                <span className="text-red-600 dark:text-red-400">-{summary.removed} {t("backups.removed")}</span>
              </p>
              {diffData && diffData.changes.some((c) => c.tag !== "equal") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setDiffExpanded(!diffExpanded)}
                >
                  {diffExpanded ? (
                    <ChevronUp className="h-3 w-3 mr-1" />
                  ) : (
                    <ChevronDown className="h-3 w-3 mr-1" />
                  )}
                  {diffExpanded ? t("backups.hideDiff") : t("backups.showDiff")}
                </Button>
              )}
            </div>
            {diffExpanded && diffData && (
              <div className="overflow-y-auto max-h-48 rounded-md border bg-muted/20 font-mono text-xs leading-5">
                {diffData.changes
                  .filter((c) => c.tag !== "equal")
                  .map((change, idx) => {
                    const content = change.tag === "insert" ? change.new_value ?? "" : change.old_value ?? "";
                    const prefix = change.tag === "delete" ? "\u2212" : "+";
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex border-b border-border/30 last:border-b-0 px-2 py-px",
                          change.tag === "delete" && "bg-red-500/8 dark:bg-red-500/10",
                          change.tag === "insert" && "bg-green-500/8 dark:bg-green-500/10",
                        )}
                      >
                        <span
                          className={cn(
                            "w-4 shrink-0 select-none",
                            change.tag === "delete" && "text-red-600 dark:text-red-400",
                            change.tag === "insert" && "text-green-600 dark:text-green-400",
                          )}
                        >
                          {prefix}
                        </span>
                        <span className="flex-1 whitespace-pre overflow-x-auto">
                          {highlightToml(content)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? t("backups.restoring") : t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

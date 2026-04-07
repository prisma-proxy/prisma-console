"use client";

import { useCallback, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast-context";
import { highlightToml } from "@/lib/toml-highlight";
import { cn } from "@/lib/utils";
import type { BackupDiff, DiffChange } from "@/lib/types";

interface DiffViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backupName: string;
  diff: BackupDiff | undefined;
  isLoading: boolean;
}

/** Threshold for collapsing consecutive equal lines */
const FOLD_THRESHOLD = 3;

interface DiffLineGroup {
  type: "line";
  change: DiffChange;
  index: number;
}

interface FoldedGroup {
  type: "fold";
  count: number;
  lines: { change: DiffChange; index: number }[];
}

type DisplayGroup = DiffLineGroup | FoldedGroup;

export function DiffViewer({
  open,
  onOpenChange,
  backupName,
  diff,
  isLoading,
}: DiffViewerProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [expandedFolds, setExpandedFolds] = useState<Set<number>>(new Set());

  // Reset state when dialog opens/closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setOnlyChanges(false);
        setExpandedFolds(new Set());
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  const handleCopy = useCallback(() => {
    if (!diff) return;
    const text = diff.changes
      .map((c) => {
        if (c.tag === "equal") return `  ${c.old_value ?? ""}`;
        if (c.tag === "delete") return `- ${c.old_value ?? ""}`;
        if (c.tag === "insert") return `+ ${c.new_value ?? ""}`;
        return "";
      })
      .join("\n");
    navigator.clipboard.writeText(text);
    toast(t("common.copied"), "success");
  }, [diff, toast, t]);

  const summary = useMemo(() => {
    if (!diff) return null;
    const added = diff.changes.filter((c) => c.tag === "insert").length;
    const removed = diff.changes.filter((c) => c.tag === "delete").length;
    const total = diff.changes.filter((c) => c.tag !== "equal").length;
    return { total, added, removed };
  }, [diff]);

  // Build display groups: fold consecutive equal lines when > threshold
  const displayGroups = useMemo((): DisplayGroup[] => {
    if (!diff) return [];

    if (onlyChanges) {
      return diff.changes
        .map((change, index) => ({ change, index }))
        .filter(({ change }) => change.tag !== "equal")
        .map(({ change, index }) => ({ type: "line" as const, change, index }));
    }

    const groups: DisplayGroup[] = [];
    let equalBuffer: { change: DiffChange; index: number }[] = [];

    const flushEqual = () => {
      if (equalBuffer.length === 0) return;
      if (equalBuffer.length > FOLD_THRESHOLD) {
        // Show first line, fold middle, show last line
        groups.push({ type: "line", change: equalBuffer[0].change, index: equalBuffer[0].index });
        const foldedLines = equalBuffer.slice(1, -1);
        groups.push({ type: "fold", count: foldedLines.length, lines: foldedLines });
        groups.push({
          type: "line",
          change: equalBuffer[equalBuffer.length - 1].change,
          index: equalBuffer[equalBuffer.length - 1].index,
        });
      } else {
        for (const item of equalBuffer) {
          groups.push({ type: "line", change: item.change, index: item.index });
        }
      }
      equalBuffer = [];
    };

    for (let i = 0; i < diff.changes.length; i++) {
      const change = diff.changes[i];
      if (change.tag === "equal") {
        equalBuffer.push({ change, index: i });
      } else {
        flushEqual();
        groups.push({ type: "line", change, index: i });
      }
    }
    flushEqual();

    return groups;
  }, [diff, onlyChanges]);

  const toggleFold = useCallback((foldIndex: number) => {
    setExpandedFolds((prev) => {
      const next = new Set(prev);
      if (next.has(foldIndex)) next.delete(foldIndex);
      else next.add(foldIndex);
      return next;
    });
  }, []);

  let lineCounter = 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="truncate">
            {t("backups.diffTitle")}: {backupName}
          </DialogTitle>
        </DialogHeader>

        {/* Controls row */}
        <div className="flex items-center justify-between px-1">
          {/* Diff summary */}
          {summary && summary.total > 0 ? (
            <p className="text-xs text-muted-foreground">
              {summary.total} {t("backups.diffSummary")}
              {" ("}
              <span className="text-green-600 dark:text-green-400">+{summary.added} {t("backups.added")}</span>
              {", "}
              <span className="text-red-600 dark:text-red-400">-{summary.removed} {t("backups.removed")}</span>
              {")"}
            </p>
          ) : (
            <div />
          )}

          {/* Only show changes toggle */}
          {diff && diff.changes.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted-foreground">{t("backups.onlyChanges")}</span>
              <Switch
                size="sm"
                checked={onlyChanges}
                onCheckedChange={(checked) => setOnlyChanges(checked as boolean)}
              />
            </label>
          )}
        </div>

        <div className="overflow-y-auto max-h-[60vh] rounded-lg border bg-muted/20">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : diff && diff.changes.length > 0 ? (
            <div className="font-mono text-xs leading-5">
              {displayGroups.map((group, groupIdx) => {
                if (group.type === "fold") {
                  const isExpanded = expandedFolds.has(groupIdx);
                  if (isExpanded) {
                    return group.lines.map((item) => {
                      lineCounter++;
                      const content = item.change.old_value ?? "";
                      return (
                        <div
                          key={`expanded-${item.index}`}
                          className="flex border-b border-border/30 last:border-b-0"
                        >
                          <span className="w-9 shrink-0 select-none text-right pr-2 py-px text-muted-foreground/40 border-r border-border/30">
                            {lineCounter}
                          </span>
                          <span className="w-5 shrink-0 text-center py-px select-none text-muted-foreground/30">
                            {" "}
                          </span>
                          <span className="flex-1 px-2 py-px whitespace-pre overflow-x-auto">
                            {highlightToml(content)}
                          </span>
                        </div>
                      );
                    });
                  }

                  lineCounter += group.count;
                  return (
                    <div
                      key={`fold-${groupIdx}`}
                      className="flex items-center justify-center border-b border-border/30 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors py-0.5"
                      onClick={() => toggleFold(groupIdx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleFold(groupIdx); }}
                    >
                      <span className="text-xs text-muted-foreground/60 select-none">
                        ... {group.count} {t("backups.unchangedLines")} ...
                      </span>
                    </div>
                  );
                }

                // Regular line
                lineCounter++;
                const { change, index } = group;
                const content = change.tag === "insert" ? change.new_value ?? "" : change.old_value ?? "";
                const prefix = change.tag === "delete" ? "\u2212" : change.tag === "insert" ? "+" : " ";

                return (
                  <div
                    key={index}
                    className={cn(
                      "flex border-b border-border/30 last:border-b-0",
                      change.tag === "delete" && "bg-red-500/8 dark:bg-red-500/10",
                      change.tag === "insert" && "bg-green-500/8 dark:bg-green-500/10",
                    )}
                  >
                    {/* Line number gutter */}
                    <span className="w-9 shrink-0 select-none text-right pr-2 py-px text-muted-foreground/40 border-r border-border/30">
                      {lineCounter}
                    </span>
                    {/* Diff indicator */}
                    <span
                      className={cn(
                        "w-5 shrink-0 text-center py-px select-none",
                        change.tag === "delete" && "text-red-600 dark:text-red-400",
                        change.tag === "insert" && "text-green-600 dark:text-green-400",
                        change.tag === "equal" && "text-muted-foreground/30",
                      )}
                    >
                      {prefix}
                    </span>
                    {/* Content with TOML highlighting */}
                    <span className="flex-1 px-2 py-px whitespace-pre overflow-x-auto">
                      {highlightToml(content)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">{t("common.noData")}</p>
          )}
        </div>

        <DialogFooter className="flex sm:flex-row sm:justify-between gap-2">
          {diff && diff.changes.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              {t("common.copy")}
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

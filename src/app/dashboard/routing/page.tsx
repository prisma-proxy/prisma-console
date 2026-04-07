"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Route as RouteIcon, Search, List, LayoutGrid, Download, Filter } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast-context";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRoutes, useCreateRoute, useUpdateRoute, useDeleteRoute } from "@/hooks/use-routes";
import { RuleEditor } from "@/components/routing/rule-editor";
import { TemplateSelector } from "@/components/routing/template-selector";
import { RuleList } from "@/components/routing/rule-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/loading-placeholder";
import type { RoutingRule } from "@/lib/types";

export default function RoutingPage() {
  const { t } = useI18n();
  const { toast } = useToast();

  const { data: routes, isLoading } = useRoutes();
  const createRoute = useCreateRoute();
  const updateRoute = useUpdateRoute();
  const deleteRoute = useDeleteRoute();

  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);
  const [duplicateData, setDuplicateData] = useState<Omit<RoutingRule, "id"> | null>(null);
  const [downloadingGeoSite, setDownloadingGeoSite] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    rule_name: string | null;
    action: string | null;
    condition_type: string | null;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced backend test
  useEffect(() => {
    if (!testQuery.trim()) {
      setTestResult(null);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.testRoute(testQuery.trim());
        setTestResult(res);
      } catch {
        setTestResult(null);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [testQuery]);

  // Client-side filter
  const filteredRules = useMemo(() => {
    if (!routes) return [];
    if (!filterQuery.trim()) return routes;
    const q = filterQuery.toLowerCase();
    return routes.filter((rule) => {
      const nameMatch = rule.name.toLowerCase().includes(q);
      const condValue =
        rule.condition.type === "All"
          ? "all"
          : rule.condition.type === "PortRange"
            ? `${rule.condition.value[0]}-${rule.condition.value[1]}`
            : String(rule.condition.value);
      const valueMatch = condValue.toLowerCase().includes(q);
      return nameMatch || valueMatch;
    });
  }, [routes, filterQuery]);

  // Action stats
  const actionStats = useMemo(() => {
    if (!routes) return { Allow: 0, Direct: 0, Block: 0, Reject: 0 };
    const counts: Record<string, number> = { Allow: 0, Direct: 0, Block: 0, Reject: 0 };
    for (const rule of routes) {
      counts[rule.action] = (counts[rule.action] || 0) + 1;
    }
    return counts;
  }, [routes]);

  function handleToggle(id: string, enabled: boolean) {
    const rule = routes?.find((r) => r.id === id);
    if (!rule) return;
    const { name, priority, condition, action } = rule;
    updateRoute.mutate(
      { id, data: { name, priority, condition, action, enabled } },
      {
        onSuccess: () => toast(t("toast.ruleSaved"), "success"),
        onError: (error: Error) => toast(error.message, "error"),
      }
    );
  }

  async function handleCreate(rule: Omit<RoutingRule, "id">) {
    await createRoute.mutateAsync(rule);
    toast(t("toast.ruleCreated"), "success");
  }

  async function handleEdit(rule: Omit<RoutingRule, "id">) {
    if (!editingRule) return;
    await updateRoute.mutateAsync({ id: editingRule.id, data: rule });
    toast(t("toast.ruleSaved"), "success");
  }

  function handleDelete(id: string) {
    deleteRoute.mutate(id, {
      onSuccess: () => toast(t("toast.ruleDeleted"), "success"),
      onError: (error: Error) => toast(error.message, "error"),
    });
  }

  function handleDuplicate(rule: RoutingRule) {
    // Open editor pre-filled with duplicated rule data (create mode, new name)
    setEditingRule(null);
    setDuplicateData({
      name: `Copy of ${rule.name}`,
      priority: rule.priority,
      condition: rule.condition,
      action: rule.action,
      enabled: rule.enabled,
    });
  }

  function handleReorder(updates: Array<{ id: string; priority: number }>) {
    for (const { id, priority } of updates) {
      const rule = routes?.find((r) => r.id === id);
      if (!rule) continue;
      updateRoute.mutate(
        { id, data: { name: rule.name, priority, condition: rule.condition, action: rule.action, enabled: rule.enabled } },
        {
          onError: (error: Error) => toast(error.message, "error"),
        }
      );
    }
    toast(t("toast.ruleSaved"), "success");
  }

  async function handleDownloadAll() {
    setDownloadingGeoSite(true);
    try {
      const results = await api.downloadAllData();
      const ok = results.filter((r: { success: boolean }) => r.success);
      const fail = results.filter((r: { success: boolean }) => !r.success);
      if (ok.length > 0) toast(t("routing.downloadAllSuccess", { count: ok.length }), "success");
      if (fail.length > 0) toast(fail.map((f: { name: string; error: string | null }) => `${f.name}: ${f.error}`).join(", "), "error");
      await api.reloadConfig().catch(() => {});
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      setDownloadingGeoSite(false);
    }
  }

  const editorKey = duplicateData ? `dup-${duplicateData.name}` : (editingRule?.id ?? "new");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("routing.routingRules")}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloadingGeoSite}
          >
            <Download className="h-4 w-4" />
            {downloadingGeoSite ? t("routing.downloading") : t("routing.downloadAllData")}
          </Button>
        <RuleEditor
          key={editorKey}
          onSubmit={editingRule ? handleEdit : handleCreate}
          isLoading={editingRule ? updateRoute.isPending : createRoute.isPending}
          editingRule={editingRule}
          initialData={duplicateData}
          onOpenChange={(open) => { if (!open) { setEditingRule(null); setDuplicateData(null); } }}
        />
        </div>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">
            <List className="h-4 w-4" />
            {t("routing.manualRules")}
          </TabsTrigger>
          <TabsTrigger value="templates">
            <LayoutGrid className="h-4 w-4" />
            {t("routing.templates")}
          </TabsTrigger>
        </TabsList>

        {/* -- Tab 1: Manual Rules -- */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {t("routing.rules")}
                  {/* Action stats badges */}
                  {(routes?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-1.5 ml-2">
                      {actionStats.Allow > 0 && (
                        <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
                          {actionStats.Allow} {t("routing.actionProxy")}
                        </Badge>
                      )}
                      {actionStats.Direct > 0 && (
                        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">
                          {actionStats.Direct} {t("routing.actionDirect")}
                        </Badge>
                      )}
                      {actionStats.Block > 0 && (
                        <Badge className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 text-[10px] px-1.5 py-0">
                          {actionStats.Block} {t("routing.actionBlock")}
                        </Badge>
                      )}
                      {actionStats.Reject > 0 && (
                        <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30 text-[10px] px-1.5 py-0">
                          {actionStats.Reject} {t("routing.actionReject")}
                        </Badge>
                      )}
                    </span>
                  )}
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {routes?.length ?? 0} {t("common.entries")}
                </span>
              </CardTitle>

              {/* Test Rule input */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 font-mono text-xs"
                  placeholder={t("routing.testPlaceholder")}
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                />
              </div>

              {/* Test result */}
              {testQuery && testResult && (
                <div className="mt-2 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  {testResult.matched ? (
                    <>
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                        testResult.action === "REJECT"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : testResult.action === "DIRECT"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      }`}>
                        {testResult.action}
                      </span>
                      <span className="text-foreground">
                        {testResult.rule_name}
                      </span>
                      {testResult.condition_type && (
                        <span className="text-xs text-muted-foreground">
                          ({testResult.condition_type})
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        NO MATCH
                      </span>
                      <span className="text-muted-foreground">
                        {t("routing.testNoMatch")}
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Filter input */}
              {(routes?.length ?? 0) > 0 && (
                <div className="relative mt-2">
                  <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 text-xs"
                    placeholder={t("routing.filterPlaceholder")}
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <SkeletonTable rows={4} />
              ) : (routes?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={RouteIcon}
                  title={t("empty.noRules")}
                  description={t("empty.noRulesHint")}
                />
              ) : filteredRules.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("routing.noFilterResults")}
                </p>
              ) : (
                <RuleList
                  rules={filteredRules}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onEdit={(rule) => setEditingRule(rule)}
                  onDuplicate={handleDuplicate}
                  onReorder={handleReorder}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -- Tab 2: Quick Templates -- */}
        <TabsContent value="templates">
          <TemplateSelector />
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/lib/toast-context";
import { useCreateRoute } from "@/hooks/use-routes";
import {
  RULE_TEMPLATES,
  TEMPLATE_CATEGORY_ORDER,
  TEMPLATE_CATEGORY_KEYS,
  type RuleTemplate,
} from "@/lib/rule-templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RuleCondition } from "@/lib/types";

/**
 * Map template condition types to the backend's RuleCondition enum.
 * Backend only supports: DomainMatch, DomainExact, IpCidr, PortRange, All.
 * Frontend-friendly types are converted:
 *   DomainSuffix  -> DomainMatch("*.value")
 *   DomainKeyword -> DomainMatch("*value*")
 *   GeoIp         -> IpCidr("geoip:value")
 */
function buildCondition(conditionType: string, conditionValue: string): RuleCondition {
  switch (conditionType) {
    case "DomainMatch":
      return { type: "DomainMatch", value: conditionValue };
    case "DomainExact":
      return { type: "DomainExact", value: conditionValue };
    case "DomainSuffix":
      return { type: "DomainMatch", value: `*.${conditionValue}` };
    case "DomainKeyword":
      return { type: "DomainMatch", value: `*${conditionValue}*` };
    case "IpCidr":
      return { type: "IpCidr", value: conditionValue };
    case "GeoIp":
      return { type: "IpCidr", value: `geoip:${conditionValue}` };
    case "PortRange": {
      const parts = conditionValue.split("-").map(Number);
      return { type: "PortRange", value: [parts[0] || 0, parts[1] || 0] };
    }
    case "All":
      return { type: "All", value: null };
    default:
      return { type: "DomainMatch", value: conditionValue };
  }
}

/** Map template action to backend's RuleAction (Allow | Direct | Block). */
function mapAction(action: string): "Allow" | "Direct" | "Block" {
  switch (action) {
    case "Direct": return "Direct";
    case "Reject": return "Block";
    case "Block": return "Block";
    default: return "Allow";
  }
}

/** Action color for preview table */
function actionColor(action: string): string {
  switch (action) {
    case "Allow": return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "Direct": return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "Block":
    case "Reject": return "bg-red-500/15 text-red-700 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

export function TemplateSelector() {
  const { t } = useI18n();
  const { toast } = useToast();
  const createRoute = useCreateRoute();
  const queryClient = useQueryClient();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleApply(template: RuleTemplate) {
    setApplyingId(template.id);
    let successCount = 0;

    try {
      for (const rule of template.rules) {
        await createRoute.mutateAsync({
          name: rule.name,
          priority: rule.priority,
          condition: buildCondition(rule.condition_type, rule.condition_value),
          action: mapAction(rule.action),
          enabled: rule.enabled,
        });
        successCount++;
      }
      await queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast(t("toast.templateApplied", { count: String(successCount) }), "success");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to apply template";
      toast(message, "error");
    } finally {
      setApplyingId(null);
    }
  }

  function togglePreview(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  // Group templates by category
  const templatesByCategory = new Map<string, RuleTemplate[]>();
  for (const tmpl of RULE_TEMPLATES) {
    const list = templatesByCategory.get(tmpl.category) ?? [];
    list.push(tmpl);
    templatesByCategory.set(tmpl.category, list);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("templates.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {TEMPLATE_CATEGORY_ORDER.map((category) => {
          const templates = templatesByCategory.get(category);
          if (!templates || templates.length === 0) return null;

          return (
            <div key={category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {t(TEMPLATE_CATEGORY_KEYS[category])}
              </h3>
              <div className="flex flex-col gap-3">
                {templates.map((template) => {
                  const Icon = template.icon;
                  const isApplying = applyingId === template.id;
                  const isExpanded = expandedId === template.id;

                  return (
                    <div
                      key={template.id}
                      className="rounded-lg border"
                    >
                      <div className="flex items-start gap-2.5 p-3.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{t(template.nameKey)}</p>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                              {template.rules.length} {t("routing.rules")}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {t(template.descKey)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePreview(template.id)}
                            className="h-8 px-2"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="text-xs ml-1">{t("routing.preview")}</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={applyingId !== null}
                            onClick={() => handleApply(template)}
                          >
                            {isApplying ? t("templates.applying") : t("templates.apply")}
                          </Button>
                        </div>
                      </div>

                      {/* Preview section */}
                      {isExpanded && (
                        <div className="border-t px-3.5 py-2.5">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground">
                                  <th className="text-left font-medium py-1 pr-3">{t("common.name")}</th>
                                  <th className="text-left font-medium py-1 pr-3">{t("routing.type")}</th>
                                  <th className="text-left font-medium py-1 pr-3">{t("routing.match")}</th>
                                  <th className="text-left font-medium py-1">{t("routing.action")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {template.rules.map((rule, i) => (
                                  <tr key={i} className="border-t border-border/50">
                                    <td className="py-1 pr-3 font-medium truncate max-w-[180px]">{rule.name}</td>
                                    <td className="py-1 pr-3">
                                      <span className="font-mono text-muted-foreground">{rule.condition_type}</span>
                                    </td>
                                    <td className="py-1 pr-3 font-mono text-muted-foreground truncate max-w-[200px]">
                                      {rule.condition_value || "-"}
                                    </td>
                                    <td className="py-1">
                                      <Badge className={`text-[10px] px-1.5 py-0 ${actionColor(rule.action)}`}>
                                        {rule.action}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

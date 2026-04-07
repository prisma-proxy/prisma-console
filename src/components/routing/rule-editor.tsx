"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { RoutingRule, RuleCondition } from "@/lib/types";

interface RuleEditorProps {
  onSubmit: (rule: Omit<RoutingRule, "id">) => Promise<void>;
  isLoading: boolean;
  /** When set, the dialog opens in edit mode pre-filled with this rule. */
  editingRule?: RoutingRule | null;
  /** Pre-fill the form for a new rule (duplicate). Opens in create mode. */
  initialData?: Omit<RoutingRule, "id"> | null;
  /** Called when the dialog is closed (used to clear editingRule in parent). */
  onOpenChange?: (open: boolean) => void;
}

/* ── Friendly condition types shown in the dropdown ── */
const FRIENDLY_TYPES = [
  "DOMAIN",
  "DOMAIN-SUFFIX",
  "DOMAIN-KEYWORD",
  "IP-CIDR",
  "GEOIP",
  "GEOSITE",
  "PORT-RANGE",
  "FINAL",
] as const;
type FriendlyType = (typeof FRIENDLY_TYPES)[number];

/* ── Friendly action types ── */
const FRIENDLY_ACTIONS = ["PROXY", "DIRECT", "REJECT"] as const;
type FriendlyAction = (typeof FRIENDLY_ACTIONS)[number];

/* ── GeoSite preset categories shown in the dropdown ── */
const GEOSITE_PRESETS = [
  "cn", "geolocation-cn", "geolocation-!cn", "tld-cn", "tld-!cn",
  "google", "facebook", "twitter", "youtube", "netflix", "amazon",
  "apple", "microsoft", "telegram", "category-ads", "category-ads-all",
  "private",
] as const;

/* ── Convert backend condition → friendly type + match string ── */
export function parseConditionType(condition: RuleCondition): { type: FriendlyType; match: string } {
  if (condition.type === "All") return { type: "FINAL", match: "" };
  if (condition.type === "DomainExact") return { type: "DOMAIN", match: condition.value as string };
  if (condition.type === "DomainMatch" || condition.type === "DomainSuffix" || condition.type === "DomainKeyword") {
    const v = condition.value as string;
    if (v.startsWith("*.")) return { type: "DOMAIN-SUFFIX", match: v.slice(2) };
    if (v.startsWith("*") && v.endsWith("*")) return { type: "DOMAIN-KEYWORD", match: v.slice(1, -1) };
    return { type: "DOMAIN", match: v };
  }
  if (condition.type === "IpCidr") {
    const v = condition.value as string;
    if (v.startsWith("geoip:")) return { type: "GEOIP", match: v.slice(6) };
    if (v.startsWith("geosite:")) return { type: "GEOSITE", match: v.slice(8) };
    return { type: "IP-CIDR", match: v };
  }
  if (condition.type === "GeoIp") return { type: "GEOIP", match: condition.value as string };
  if (condition.type === "PortRange") {
    const val = condition.value as [number, number];
    return { type: "PORT-RANGE", match: `${val[0]}-${val[1]}` };
  }
  return { type: "DOMAIN", match: String((condition as { value?: unknown }).value ?? "") };
}

/* ── Convert backend action → friendly action ── */
export function parseAction(action: string): FriendlyAction {
  switch (action) {
    case "Allow": return "PROXY";
    case "Direct": return "DIRECT";
    case "Block": return "REJECT";
    case "Reject": return "REJECT";
    default: return "PROXY";
  }
}

/* ── Convert friendly type + match → backend RuleCondition ── */
function buildCondition(type: FriendlyType, match: string): RuleCondition {
  switch (type) {
    case "DOMAIN":
      return { type: "DomainExact", value: match };
    case "DOMAIN-SUFFIX":
      return { type: "DomainMatch", value: `*.${match}` };
    case "DOMAIN-KEYWORD":
      return { type: "DomainMatch", value: `*${match}*` };
    case "IP-CIDR":
      return { type: "IpCidr", value: match };
    case "GEOIP":
      return { type: "IpCidr", value: `geoip:${match}` };
    case "GEOSITE":
      return { type: "IpCidr", value: `geosite:${match}` };
    case "PORT-RANGE": {
      const [a, b] = match.split("-").map(Number);
      return { type: "PortRange", value: [a || 0, b || a || 0] };
    }
    case "FINAL":
      return { type: "All", value: null };
  }
}

/* ── Convert friendly action → backend action ── */
function mapAction(action: FriendlyAction): "Allow" | "Direct" | "Block" {
  switch (action) {
    case "PROXY": return "Allow";
    case "DIRECT": return "Direct";
    case "REJECT": return "Block";
    default: return "Allow";
  }
}

/* ── Validation helpers ── */
const IPV4_CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

function getValidationHint(condType: FriendlyType, value: string): string | null {
  if (!value) return null;

  switch (condType) {
    case "IP-CIDR": {
      // IPv6 check: contains : and /
      const isV6 = value.includes(":") && value.includes("/");
      if (!isV6 && !IPV4_CIDR_RE.test(value)) {
        return "Expected format: 192.168.0.0/24 or 2001:db8::/32";
      }
      return null;
    }
    case "PORT-RANGE": {
      const parts = value.split("-");
      if (parts.length !== 2) return "Expected format: 1000-2000 (0-65535)";
      const [a, b] = parts.map(Number);
      if (isNaN(a) || isNaN(b) || a < 0 || a > 65535 || b < 0 || b > 65535) {
        return "Expected format: 1000-2000 (0-65535)";
      }
      if (a > b) {
        return "Expected format: 1000-2000 (0-65535)";
      }
      return null;
    }
    case "DOMAIN":
    case "DOMAIN-SUFFIX":
    case "DOMAIN-KEYWORD": {
      if (value.startsWith("http://") || value.startsWith("https://")) {
        return "Enter domain without protocol prefix";
      }
      return null;
    }
    default:
      return null;
  }
}

export function RuleEditor({ onSubmit, isLoading, editingRule, initialData, onOpenChange }: RuleEditorProps) {
  const { t } = useI18n();
  const isEditing = !!editingRule;

  // Use editingRule for edit mode, or initialData for duplicate/pre-fill mode
  const prefill = editingRule ?? (initialData ? { ...initialData, id: "" } as RoutingRule : null);

  const initialType: FriendlyType = prefill
    ? parseConditionType(prefill.condition).type
    : "FINAL";
  const initialMatch = prefill
    ? parseConditionType(prefill.condition).match
    : "";
  const initialAction: FriendlyAction = prefill
    ? parseAction(prefill.action)
    : "PROXY";

  const [open, setOpen] = useState(isEditing || !!initialData);
  const [name, setName] = useState(prefill?.name ?? "");
  const [priority, setPriority] = useState(prefill?.priority ?? 0);
  const [condType, setCondType] = useState<FriendlyType>(initialType);
  const [match, setMatch] = useState(initialMatch);
  const [action, setAction] = useState<FriendlyAction>(initialAction);
  const [enabled, setEnabled] = useState(prefill?.enabled ?? true);

  // Test state
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    matched: boolean;
    rule_name: string | null;
    action: string | null;
  } | null>(null);

  function resetForm() {
    setName("");
    setPriority(0);
    setCondType("FINAL");
    setMatch("");
    setAction("PROXY");
    setEnabled(true);
    setTestResult(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
      onOpenChange?.(false);
    }
  }

  function conditionPlaceholder(): string {
    switch (condType) {
      case "PORT-RANGE": return "e.g. 8000-9000";
      case "IP-CIDR": return "e.g. 192.168.1.0/24";
      case "GEOIP": return "e.g. CN, US, JP";
      case "GEOSITE": return "e.g. cn, google, ads";
      case "DOMAIN-SUFFIX": return "e.g. google.com";
      case "DOMAIN-KEYWORD": return "e.g. facebook";
      case "DOMAIN": return "e.g. www.example.com";
      default: return "";
    }
  }

  async function handleTest() {
    if (!match.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await api.testRoute(match.trim());
      setTestResult(res);
    } catch {
      setTestResult(null);
    } finally {
      setTestLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await onSubmit({
        name,
        priority,
        condition: buildCondition(condType, match),
        action: mapAction(action),
        enabled,
      });
      resetForm();
      setOpen(false);
      onOpenChange?.(false);
    } catch {
      // Keep form open on failure so the user can retry
    }
  }

  const validationHint = getValidationHint(condType, match);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isEditing && !initialData && (
        <DialogTrigger className={cn(buttonVariants())}>{t("routing.addRule")}</DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("routing.editRule") : t("routing.createRule")}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t("routing.editRuleDescription")
              : t("routing.createRuleDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="grid gap-1.5">
            <Label htmlFor="rule-name">{t("common.name")}</Label>
            <Input
              id="rule-name"
              type="text"
              placeholder={t("routing.ruleNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Type */}
          <div className="grid gap-1.5">
            <Label>{t("routing.type")}</Label>
            <Select
              value={condType}
              onValueChange={(val) => {
                setCondType(val as FriendlyType);
                if (val === "FINAL") setMatch("");
                setTestResult(null);
              }}
            >
              <SelectTrigger className="w-full">
                <span className="flex flex-1 text-left font-mono text-xs">{condType}</span>
              </SelectTrigger>
              <SelectContent>
                {FRIENDLY_TYPES.map((ft) => (
                  <SelectItem key={ft} value={ft}>
                    <span className="font-mono text-xs">{ft}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Match (hidden when FINAL) */}
          {condType !== "FINAL" && (
            <div className="grid gap-1.5">
              <Label htmlFor="rule-match">{t("routing.match")}</Label>
              {condType === "GEOSITE" ? (
                <Select value={match} onValueChange={(v) => setMatch(v ?? "")}>
                  <SelectTrigger>
                    {match || conditionPlaceholder()}
                  </SelectTrigger>
                  <SelectContent>
                    {GEOSITE_PRESETS.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        <span className="font-mono text-xs">{cat}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="rule-match"
                    type="text"
                    placeholder={conditionPlaceholder()}
                    value={match}
                    onChange={(e) => {
                      setMatch(e.target.value);
                      setTestResult(null);
                    }}
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={testLoading || !match.trim()}
                    className="shrink-0"
                  >
                    {testLoading ? t("routing.testing") : t("routing.testBtn")}
                  </Button>
                </div>
              )}

              {/* Validation hint */}
              {validationHint && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {validationHint}
                </p>
              )}

              {/* Inline test result */}
              {testResult && (
                <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                  {testResult.matched ? (
                    <>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${
                          testResult.action === "REJECT" || testResult.action === "Block"
                            ? "bg-red-500/15 text-red-700 dark:text-red-400"
                            : testResult.action === "DIRECT" || testResult.action === "Direct"
                              ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                              : "bg-green-500/15 text-green-700 dark:text-green-400"
                        }`}
                      >
                        {testResult.action}
                      </Badge>
                      <span className="text-foreground truncate">
                        {testResult.rule_name}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("routing.testNoMatch")}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action */}
          <div className="grid gap-1.5">
            <Label>{t("routing.action")}</Label>
            <Select
              value={action}
              onValueChange={(val) => setAction(val as FriendlyAction)}
            >
              <SelectTrigger className="w-full">
                <span className="flex flex-1 text-left">{t(`routing.${action.toLowerCase()}`)}</span>
              </SelectTrigger>
              <SelectContent>
                {FRIENDLY_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {t(`routing.${a.toLowerCase()}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="grid gap-1.5">
            <Label htmlFor="rule-priority">{t("routing.priority")}</Label>
            <Input
              id="rule-priority"
              type="number"
              placeholder="0"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
            />
          </div>

          {/* Enabled */}
          <div className="flex items-center justify-between">
            <Label htmlFor="rule-enabled">{t("routing.enabled")}</Label>
            <Switch
              id="rule-enabled"
              checked={enabled}
              onCheckedChange={(checked: boolean) => setEnabled(checked)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? t("routing.creatingRule")
                : isEditing
                  ? t("routing.saveRule")
                  : t("routing.createRule")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

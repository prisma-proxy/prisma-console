"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle, Wifi } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/auth";
import { useServerStore } from "@/lib/server-store";

interface ReloadEvent {
  timestamp: string;
  success: boolean;
  message: string;
  changes: string[];
}

export function ReloadStatus() {
  const { toast } = useToast();
  const [reloading, setReloading] = useState(false);
  const [lastEvent, setLastEvent] = useState<ReloadEvent | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [restartRequired] = useState(false);

  // Subscribe to WebSocket reload events
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const base = useServerStore.getState().getActiveServer()?.url || "";
    const wsBase = base.replace(/^http/, "ws") || `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
    const wsUrl = `${wsBase}/api/ws/reload?token=${encodeURIComponent(token)}`;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => setWsConnected(true);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ReloadEvent;
          setLastEvent(data);
          if (data.success) {
            toast(data.message, "success");
          } else {
            toast(data.message, "error");
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [toast]);

  const handleReload = useCallback(async () => {
    setReloading(true);
    try {
      const result = await api.reloadConfig();
      setLastEvent({
        timestamp: new Date().toISOString(),
        success: result.success,
        message: result.message,
        changes: result.changes,
      });
      if (result.success) {
        toast(result.message, "success");
      } else {
        toast(result.message, "error");
      }
    } catch {
      toast("Reload failed", "error");
    } finally {
      setReloading(false);
    }
  }, [toast]);

  return (
    <div className="space-y-4">
      {/* Restart required banner */}
      {restartRequired && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Server restart required
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Some changes (listen addresses, transports) require a server restart to take effect.
            </p>
          </div>
        </div>
      )}

      {/* Reload controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReload}
            disabled={reloading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reloading ? "animate-spin" : ""}`} />
            {reloading ? "Reloading..." : "Reload Configuration"}
          </Button>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wifi className={`h-3 w-3 ${wsConnected ? "text-green-500" : "text-muted-foreground"}`} />
            {wsConnected ? "Live updates connected" : "Reconnecting..."}
          </span>
        </div>
      </div>

      {/* Last reload event */}
      {lastEvent && (
        <div
          className={`rounded-lg border px-4 py-3 ${
            lastEvent.success
              ? "border-green-500/20 bg-green-500/5"
              : "border-destructive/20 bg-destructive/5"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {lastEvent.success ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className="text-xs font-medium">{lastEvent.message}</span>
          </div>
          {lastEvent.changes.length > 0 && (
            <ul className="ml-5 space-y-0.5">
              {lastEvent.changes.map((change, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  {change}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[10px] text-muted-foreground">
            {new Date(lastEvent.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}

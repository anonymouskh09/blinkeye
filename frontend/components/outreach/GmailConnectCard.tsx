"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Unplug, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiResponse, GmailStatus } from "@/types";

const statusLabel: Record<string, string> = {
  connected: "Connected",
  not_connected: "Not Connected",
  needs_reconnect: "Needs Reconnect",
};

const statusColor: Record<string, string> = {
  connected: "bg-green-100 text-green-700",
  not_connected: "bg-gray-100 text-gray-600",
  needs_reconnect: "bg-amber-100 text-amber-800",
};

export default function GmailConnectCard() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<GmailStatus>>("/gmail/status");
      setStatus(res.data.data);
    } catch {
      toast.error("Failed to load Gmail status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    const gmail = searchParams.get("gmail");
    if (gmail === "connected") {
      toast.success("Gmail connected successfully");
      fetchStatus();
      window.history.replaceState({}, "", "/outreach");
    } else if (gmail === "error") {
      const message = searchParams.get("message") || "Gmail connection failed";
      toast.error(message === "missing_code" ? "Google did not return authorization. Check redirect URI in Google Console." : message);
      window.history.replaceState({}, "", "/outreach");
    }
  }, [searchParams, fetchStatus]);

  const handleConnect = () => {
    // Must use same host as login (localhost), NOT 127.0.0.1 — otherwise auth cookie is not sent
    const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
    window.location.href = `http://${hostname}:8000/gmail/connect`;
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Gmail from RecruitPro?")) return;
    setDisconnecting(true);
    try {
      await api.post("/gmail/disconnect");
      toast.success("Gmail disconnected");
      fetchStatus();
    } catch {
      toast.error("Failed to disconnect Gmail");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="content-panel p-6 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-40 mb-3" />
        <div className="h-4 bg-gray-100 rounded w-64" />
      </div>
    );
  }

  const dailyLimitReached = status && status.sent_today >= status.daily_limit;

  return (
    <div className="content-panel p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-gray-900">Connect Gmail</h2>
          </div>
          <p className="text-sm text-gray-500">
            Outreach emails are sent from your own Gmail account via OAuth.
          </p>
        </div>
        <Badge className={cn("uppercase text-[10px]", statusColor[status?.status || "not_connected"])}>
          {statusLabel[status?.status || "not_connected"]}
        </Badge>
      </div>

      {status?.connected && status.email_address && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-sm">
          <p className="text-gray-500">Connected account</p>
          <p className="font-medium text-gray-900">{status.email_address}</p>
          {status.last_connected_at && (
            <p className="text-xs text-gray-400 mt-1">Last connected {new Date(status.last_connected_at).toLocaleString()}</p>
          )}
        </div>
      )}

      {status?.last_error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {status.last_error}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {!status?.connected ? (
          <Button onClick={handleConnect}>
            <Mail className="h-4 w-4 mr-1.5" /> Connect Gmail
          </Button>
        ) : (
          <Button variant="outline" onClick={handleDisconnect} loading={disconnecting}>
            <Unplug className="h-4 w-4 mr-1.5" /> Disconnect
          </Button>
        )}
        {status?.status === "needs_reconnect" && (
          <Button onClick={handleConnect}>Reconnect Gmail</Button>
        )}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Deliverability notice</p>
          <p className="mt-1 text-amber-800/90">
            Cold outreach can affect your Gmail reputation. Start with low daily volume and only contact relevant candidates.
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Sent today: {status?.sent_today ?? 0} / {status?.daily_limit ?? 30}
            {dailyLimitReached ? " — daily limit reached" : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

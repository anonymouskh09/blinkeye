"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Link2, Link2Off, Puzzle, RefreshCw, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import CopyButton from "@/components/ui/CopyButton";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import type { ApiResponse } from "@/types";

interface ExtensionStatus {
  connected: boolean;
}

interface ConnectCode {
  code: string;
  expires_in: number | null;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<ExtensionStatus>>("/extension/status");
      setConnected(res.data.data?.connected ?? false);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post<ApiResponse<ConnectCode>>("/extension/connect-code");
      setCode(res.data.data?.code ?? null);
      setExpiresIn(res.data.data?.expires_in ?? null);
      toast.success("Connection code generated");
    } catch {
      toast.error("Failed to generate code");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await api.post("/extension/revoke");
      setCode(null);
      toast.success("Extension disconnected");
      fetchStatus();
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setRevoking(false);
    }
  };

  const expiryMinutes = expiresIn ? Math.round(expiresIn / 60) : null;

  return (
    <PageWrapper>
      <Header title="Settings" subtitle="Manage your account and integrations" />

      <div className="content-panel">
        <div className="p-6 max-w-3xl">
          <div className="flex items-start gap-4 pb-5 border-b border-gray-100">
            <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary flex items-center justify-center shrink-0">
              <Puzzle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-semibold text-gray-900">Chrome Extension</h2>
                {loading ? (
                  <span className="text-xs text-gray-400">Checking…</span>
                ) : connected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                    <Link2 className="h-3.5 w-3.5" /> Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
                    <Link2Off className="h-3.5 w-3.5" /> Not connected
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Import LinkedIn candidate profiles straight into RecruitPro with the
                {" "}RecruitPro Candidate Importer browser extension.
              </p>
            </div>
            <button onClick={fetchStatus} className="btn-icon" aria-label="Refresh status">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Connect */}
          <div className="py-5 border-b border-gray-100">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <KeyRound className="h-4 w-4 text-gray-400" /> Connect a device
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Generate a one-time connection code, then paste it into the extension popup to
              sign in as <span className="font-medium text-gray-700">{user?.email}</span>.
            </p>

            {code ? (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Your connection code
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <code className="flex-1 break-all rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
                    {code}
                  </code>
                  <CopyButton value={code} label="Copy code" size="md" />
                </div>
                <p className="mt-2 text-xs text-amber-600">
                  This code is single-use{expiryMinutes ? ` and expires in about ${expiryMinutes} minute${expiryMinutes === 1 ? "" : "s"}` : ""}.
                  Do not share it.
                </p>
              </div>
            ) : null}

            <div className="mt-4">
              <Button onClick={handleGenerate} loading={generating}>
                {code ? "Generate new code" : "Generate connection code"}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="py-5 border-b border-gray-100">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
              <ShieldCheck className="h-4 w-4 text-gray-400" /> How to install
            </h3>
            <ol className="mt-3 space-y-2 text-sm text-gray-600 list-decimal list-inside">
              <li>Build the extension (<code className="text-xs">npm run build</code> in <code className="text-xs">chrome-extension/</code>).</li>
              <li>Open <code className="text-xs">chrome://extensions</code> and enable <span className="font-medium">Developer mode</span>.</li>
              <li>Click <span className="font-medium">Load unpacked</span> and select the <code className="text-xs">chrome-extension/dist</code> folder.</li>
              <li>Open a LinkedIn profile, click the RecruitPro icon, and paste your connection code.</li>
            </ol>
          </div>

          {/* Disconnect */}
          <div className="pt-5">
            <h3 className="text-sm font-semibold text-gray-800">Disconnect</h3>
            <p className="mt-1 text-sm text-gray-500">
              Revoke access for all connected devices. Existing sessions will stop working immediately.
            </p>
            <div className="mt-3">
              <Button variant="danger" onClick={handleRevoke} loading={revoking} disabled={connected === false}>
                <Link2Off className="h-4 w-4 mr-1.5" /> Disconnect extension
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

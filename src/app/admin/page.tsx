"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Key, Gamepad2, Trash2, Copy, Check, RefreshCw, ArrowLeft, Eye, ShieldCheck, XCircle } from "lucide-react";

interface KeyRecord {
  id: string;
  key: string;
  type: string;
  status: string;
  label: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [label, setLabel] = useState("");
  const [count, setCount] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message: string; type?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/generate-key");
      const data = await res.json();
      setKeys(data.keys || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const generateKeys = async (type: "license" | "game") => {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/generate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, label, count }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchKeys();
      }
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  const deleteKey = async (id: string) => {
    try {
      await fetch(`/api/admin/generate-key?id=${id}`, { method: "DELETE" });
      await fetchKeys();
    } catch {
      // ignore
    }
  };

  const deleteAll = async () => {
    if (!confirm("Delete ALL keys? This cannot be undone.")) return;
    try {
      await fetch("/api/admin/generate-key", { method: "DELETE" });
      await fetchKeys();
    } catch {
      // ignore
    }
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const verifyKey = async () => {
    if (!verifyInput.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/admin/verify-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: verifyInput.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        setVerifyResult({
          valid: true,
          message: `VALID — ${data.type === "game" ? "Game Key" : "License Key"} · ${data.status}`,
          type: data.type,
        });
      } else {
        setVerifyResult({
          valid: false,
          message: `INVALID — ${data.error}`,
        });
      }
    } catch {
      setVerifyResult({
        valid: false,
        message: "FAILED — Could not verify key (database not available)",
      });
    } finally {
      setVerifying(false);
    }
  };

  const licenseKeys = keys.filter(k => k.type === "license");
  const gameKeys = keys.filter(k => k.type === "game");

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-[#448AFF] hover:text-[#5598FF] transition">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-[#ff2d55] font-black">VILLAGE</span>
              <span className="text-white/70 text-sm">APNA</span>
              <span className="text-[#448AFF]">Admin</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-[#2ed573] hover:bg-[#2ed573]/10 gap-1">
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">View Live Page</span>
              </Button>
            </a>
            <Button variant="ghost" size="sm" onClick={fetchKeys} disabled={loading} className="text-[#448AFF]">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Generate section */}
        <Card className="bg-[#141827] border-[#1e2240] mb-6">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white">Generate Keys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[#8899cc] uppercase mb-1 block">Label (optional)</label>
                <Input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="VIP, Standard, etc."
                  className="bg-[#0d1020] border-[#1e2240] text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-[#8899cc] uppercase mb-1 block">Count</label>
                <Input
                  type="number"
                  value={count}
                  onChange={e => setCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="bg-[#0d1020] border-[#1e2240] text-white"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => generateKeys("license")}
                disabled={generating}
                className="flex-1 bg-[#448AFF] hover:bg-[#5598FF] text-white"
              >
                <Key className="w-4 h-4 mr-2" />
                Generate License Keys
              </Button>
              <Button
                onClick={() => generateKeys("game")}
                disabled={generating}
                className="flex-1 bg-[#ff2d55] hover:bg-[#ff4068] text-white"
              >
                <Gamepad2 className="w-4 h-4 mr-2" />
                Generate Game Keys
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Verify Key section */}
        <Card className="bg-[#141827] border-[#1e2240] mb-6">
          <CardHeader>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2ed573]" />
              Verify Key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={verifyInput}
                onChange={e => setVerifyInput(e.target.value.toUpperCase())}
                placeholder="Paste key here (e.g. XXXX-XXXX-XXXX-XXXX)"
                className="bg-[#0d1020] border-[#1e2240] text-white font-mono"
                onKeyDown={e => { if (e.key === "Enter") verifyKey(); }}
              />
              <Button
                onClick={verifyKey}
                disabled={verifying || !verifyInput.trim()}
                className="bg-[#2ed573] hover:bg-[#3edd83] text-black font-bold"
              >
                {verifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Verify
              </Button>
            </div>
            {verifyResult && (
              <div className={`rounded-lg px-3 py-2 flex items-center gap-2 text-sm ${
                verifyResult.valid
                  ? "bg-[#2ed573]/10 border border-[#2ed573]/30 text-[#2ed573]"
                  : "bg-[#ff4757]/10 border border-[#ff4757]/30 text-[#ff4757]"
              }`}>
                {verifyResult.valid
                  ? <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{verifyResult.message}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Keys list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* License Keys */}
          <Card className="bg-[#141827] border-[#1e2240]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Key className="w-4 h-4 text-[#448AFF]" />
                License Keys ({licenseKeys.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <div className="space-y-1.5">
                  {licenseKeys.length === 0 ? (
                    <p className="text-[#5a6a99] text-xs text-center py-4">No license keys yet</p>
                  ) : (
                    licenseKeys.map(k => (
                      <KeyRow key={k.id} k={k} copied={copied} onCopy={copyKey} onDelete={deleteKey} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Game Keys */}
          <Card className="bg-[#141827] border-[#1e2240]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-[#ff2d55]" />
                Game Keys ({gameKeys.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <div className="space-y-1.5">
                  {gameKeys.length === 0 ? (
                    <p className="text-[#5a6a99] text-xs text-center py-4">No game keys yet</p>
                  ) : (
                    gameKeys.map(k => (
                      <KeyRow key={k.id} k={k} copied={copied} onCopy={copyKey} onDelete={deleteKey} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {keys.length > 0 && (
          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={deleteAll} className="text-[#ff4757] hover:bg-[#ff4757]/10">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All Keys
            </Button>
          </div>
        )}

        {/* Live page link */}
        <div className="mt-6 text-center pb-6">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <Button className="bg-[#2ed573] hover:bg-[#3edd83] text-black font-bold gap-2">
              <Eye className="w-4 h-4" />
              Open Live Prediction Page
            </Button>
          </a>
          <p className="text-[10px] text-[#5a6a99] mt-2">
            Opens the Crazy Time live prediction page in a new tab
          </p>
        </div>
      </div>
    </div>
  );
}

function KeyRow({
  k,
  copied,
  onCopy,
  onDelete,
}: {
  k: KeyRecord;
  copied: string | null;
  onCopy: (key: string) => void;
  onDelete: (id: string) => void;
}) {
  const statusColor =
    k.status === "active" ? "#2ed573" : k.status === "used" ? "#ffa502" : "#ff4757";

  return (
    <div className="flex items-center gap-2 rounded-lg bg-[#0d1020] border border-[#1e2240] px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-sm text-white truncate">{k.key}</div>
        <div className="flex items-center gap-2 text-[9px] text-[#5a6a99]">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
          <span>{k.status}</span>
          {k.label && <span>· {k.label}</span>}
          <span>· {new Date(k.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <button onClick={() => onCopy(k.key)} className="text-[#448AFF] hover:text-[#5598FF] transition flex-shrink-0">
        {copied === k.key ? <Check className="w-4 h-4 text-[#2ed573]" /> : <Copy className="w-4 h-4" />}
      </button>
      <button onClick={() => onDelete(k.id)} className="text-[#ff4757] hover:text-[#ff6070] transition flex-shrink-0">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

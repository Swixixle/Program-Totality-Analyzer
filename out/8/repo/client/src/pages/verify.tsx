import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle, XCircle, AlertCircle, Shield, Link2, Hash, Play } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { HaloHeader } from "@/components/halo-header";
import type { ProofPack } from "@shared/schema";

const DEMO_RECEIPT_ID = "halo-demo-receipt-001";

interface NormalizedResult {
  verification_status: string;
  hash_match: boolean;
  signature_status: string;
  chain_status: string;
  receipt_id: string;
  audit_status?: string;
  audit_total_events?: number;
  audit_head_hash?: string | null;
}

function normalizeFromVerifyResult(data: any): NormalizedResult {
  return {
    verification_status: data.verification_status,
    hash_match: data.integrity?.hash_match ?? data.hash_match ?? false,
    signature_status: data.signature?.status ?? data.signature_status ?? "UNKNOWN",
    chain_status: data.chain?.status ?? data.chain_status ?? "NOT_CHECKED",
    receipt_id: data.receipt_id,
  };
}

function normalizeFromProofPack(data: ProofPack): NormalizedResult {
  return {
    verification_status: data.verification_status,
    hash_match: data.integrity.hash_match,
    signature_status: data.signature.status,
    chain_status: data.chain.status,
    receipt_id: data.receipt_id,
    audit_status: data.audit.status,
    audit_total_events: data.audit.total_events,
    audit_head_hash: data.audit.head_hash,
  };
}

export default function Verify() {
  const [capsuleJson, setCapsuleJson] = useState("");
  const [receiptId, setReceiptId] = useState("");
  const [publicOnly, setPublicOnly] = useState(false);
  const [error, setError] = useState<{ code: number; message: string } | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleTryDemo = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      await fetch("/api/demo/seed", { method: "POST" });
      setPublicOnly(true);
      setReceiptId(DEMO_RECEIPT_ID);
      setTimeout(() => {
        proofPackMutation.mutate(DEMO_RECEIPT_ID);
      }, 100);
    } catch {
      setError({ code: 500, message: "Failed to seed demo receipt" });
    } finally {
      setDemoLoading(false);
    }
  };

  const verifyPrivateMutation = useMutation({
    mutationFn: async (capsule: object) => {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(capsule),
      });
      if (!res.ok) {
        const err = new Error("Verification failed") as Error & { status: number; retryAfter?: string };
        err.status = res.status;
        err.retryAfter = res.headers.get("Retry-After") || undefined;
        throw err;
      }
      return res.json();
    },
    onError: (err: Error & { status?: number; retryAfter?: string }) => {
      const status = err.status || 500;
      const retryAfter = (err as any).retryAfter;
      if (status === 413) {
        setError({ code: 413, message: "Capsule exceeds size cap. Split transcript or use redacted mode." });
      } else if (status === 429) {
        const timestamp = retryAfter || new Date(Date.now() + 60000).toISOString();
        setError({ code: 429, message: `Rate limited. Retry after ${timestamp}.` });
      } else if (status === 401 || status === 403) {
        setError({ code: status, message: "Private endpoints require x-api-key." });
      } else {
        setError({ code: status, message: err.message || "Verification failed" });
      }
    },
    onSuccess: () => {
      setError(null);
    },
  });

  const proofPackMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/proofpack/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const err = new Error("ProofPack lookup failed") as Error & { status: number; retryAfter?: string };
        err.status = res.status;
        err.retryAfter = res.headers.get("Retry-After") || undefined;
        throw err;
      }
      return res.json() as Promise<ProofPack>;
    },
    onError: (err: Error & { status?: number; retryAfter?: string }) => {
      const status = err.status || 500;
      const retryAfter = (err as any).retryAfter;
      if (status === 404) {
        setError({ code: 404, message: "Receipt not found." });
      } else if (status === 429) {
        const timestamp = retryAfter || new Date(Date.now() + 60000).toISOString();
        setError({ code: 429, message: `Rate limited. Retry after ${timestamp}.` });
      } else {
        setError({ code: status, message: err.message || "ProofPack lookup failed" });
      }
    },
    onSuccess: () => {
      setError(null);
    },
  });

  const handleVerify = () => {
    setError(null);
    if (publicOnly) {
      if (!receiptId.trim()) {
        setError({ code: 400, message: "Receipt ID is required" });
        return;
      }
      proofPackMutation.mutate(receiptId.trim());
    } else {
      try {
        const parsed = JSON.parse(capsuleJson);
        verifyPrivateMutation.mutate(parsed);
      } catch {
        setError({ code: 400, message: "Invalid JSON format" });
      }
    }
  };

  const isPending = verifyPrivateMutation.isPending || proofPackMutation.isPending;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapsuleJson(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-green-600" data-testid="badge-verified">VERIFIED</Badge>;
      case "PARTIALLY_VERIFIED":
        return <Badge className="bg-yellow-600" data-testid="badge-partial">PARTIALLY VERIFIED</Badge>;
      case "UNVERIFIED":
        return <Badge variant="destructive" data-testid="badge-unverified">UNVERIFIED</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const privateResult = verifyPrivateMutation.data;
  const proofPackResult = proofPackMutation.data;
  
  const result: NormalizedResult | undefined = privateResult
    ? normalizeFromVerifyResult(privateResult)
    : proofPackResult
      ? normalizeFromProofPack(proofPackResult)
      : undefined;

  return (
    <div>
      {result && (
        <HaloHeader
          killSwitchEngaged={false}
          verificationStatus={result.verification_status as "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED"}
          transcriptMode="full"
        />
      )}
      <div className="container mx-auto p-6 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6" data-testid="text-verify-title">Verify</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{publicOnly ? "ProofPack Lookup" : "Submit Receipt Capsule"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Switch
              id="public-only"
              checked={publicOnly}
              onCheckedChange={setPublicOnly}
              data-testid="switch-public-only"
            />
            <Label htmlFor="public-only">ProofPack lookup (receipt ID only)</Label>
          </div>

          {publicOnly ? (
            <div>
              <Label htmlFor="receipt-id-input">Receipt ID</Label>
              <Input
                id="receipt-id-input"
                data-testid="input-receipt-id"
                placeholder="Enter receipt ID"
                value={receiptId}
                onChange={(e) => setReceiptId(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Public endpoint: no API key required
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="capsule-input">Paste JSON Capsule</Label>
                <Textarea
                  id="capsule-input"
                  data-testid="input-capsule-json"
                  placeholder='{"schema": "ai-receipt/1.0", ...}'
                  value={capsuleJson}
                  onChange={(e) => setCapsuleJson(e.target.value)}
                  className="font-mono text-sm min-h-[200px]"
                />
              </div>

              <div className="flex items-center gap-4">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 border rounded-md hover-elevate">
                    <Upload className="w-4 h-4" />
                    Upload JSON file
                  </div>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleFileUpload}
                    data-testid="input-file-upload"
                  />
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Private endpoint: requires x-api-key
              </p>
            </>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleVerify}
              disabled={publicOnly ? !receiptId : !capsuleJson || isPending}
              data-testid="button-verify"
            >
              {isPending ? "Verifying..." : "Verify"}
            </Button>
            <Button
              variant="outline"
              onClick={handleTryDemo}
              disabled={demoLoading || isPending}
              data-testid="button-try-demo"
            >
              <Play className="w-4 h-4 mr-2" />
              {demoLoading ? "Loading..." : "Try Demo"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive" data-testid="text-error">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Error {error.code}</span>
            </div>
            <p className="mt-2">{error.message}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <span className="font-semibold">Verification Result:</span>
            {getStatusBadge(result.verification_status)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-hash">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Hash
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {result.hash_match ? (
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  )}
                  <Badge
                    className={result.hash_match ? "bg-green-600" : ""}
                    variant={result.hash_match ? "default" : "destructive"}
                    data-testid="badge-hash-status"
                  >
                    {result.hash_match ? "MATCH" : "FAIL"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">SHA-256 / c14n-v1</p>
              </CardContent>
            </Card>

            <Card data-testid="card-signature">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Signature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {result.signature_status === "VALID" ? (
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  ) : result.signature_status === "NO_SIGNATURE" || result.signature_status === "UNTRUSTED_ISSUER" ? (
                    <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  )}
                  <Badge
                    className={result.signature_status === "VALID" ? "bg-green-600" : result.signature_status === "INVALID" ? "" : "bg-yellow-600"}
                    variant={result.signature_status === "INVALID" ? "destructive" : "default"}
                    data-testid="badge-signature-status"
                  >
                    {result.signature_status === "NO_SIGNATURE" ? "UNKNOWN" : result.signature_status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Ed25519</p>
              </CardContent>
            </Card>

            <Card data-testid="card-chain">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Audit Chain
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {result.chain_status === "LINKED" || result.chain_status === "GENESIS" ? (
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                  ) : result.chain_status === "NOT_CHECKED" ? (
                    <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  )}
                  <Badge
                    className={
                      result.chain_status === "LINKED" || result.chain_status === "GENESIS"
                        ? "bg-green-600"
                        : result.chain_status === "BROKEN"
                          ? ""
                          : "bg-yellow-600"
                    }
                    variant={result.chain_status === "BROKEN" ? "destructive" : "default"}
                    data-testid="badge-chain-status"
                  >
                    {result.chain_status === "NOT_CHECKED" ? "PARTIAL" : result.chain_status}
                  </Badge>
                </div>
                {result.audit_status && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {result.audit_total_events} events | {result.audit_status}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            This status reflects cryptographic and chain checks only.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}

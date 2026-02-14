import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Key, Shield, Database, Clock, ScrollText, RefreshCw, ChevronLeft, ChevronRight, Copy, Check, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { AuthRequiredBanner, isAuthError } from "@/components/auth-required-banner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { AuditEvent } from "@shared/schema";

interface AuditVerifyResponse {
  status: "EMPTY" | "GENESIS" | "LINKED" | "BROKEN";
  checked: number;
  totalEvents: number;
  partial: boolean;
  head: { seq: number; hash: string } | null;
  expectedHead: { seq: number; hash: string } | null;
  break: {
    seq: number;
    reason: string;
  } | null;
}

interface AuditPagedResponse {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const KEY_REGISTRY = [
  { key_id: "test-key-001", issuer_label: "AI Receipts Test", status: "ACTIVE", valid_from: "2024-01-01", valid_to: null, revoked_reason: null },
  { key_id: "test-key-002-rotated", issuer_label: "AI Receipts Test (Rotated)", status: "ACTIVE", valid_from: "2024-06-01", valid_to: null, revoked_reason: null },
  { key_id: "revoked-key-001", issuer_label: "AI Receipts Test", status: "REVOKED", valid_from: "2024-01-01", valid_to: "2024-03-15", revoked_reason: "Key compromise" },
  { key_id: "expired-key-001", issuer_label: "AI Receipts Test", status: "EXPIRED", valid_from: "2023-01-01", valid_to: "2023-12-31", revoked_reason: null },
];

const RATE_LIMITS = [
  { endpoint: "Public verify", limit: "100/min", burst: "10/sec" },
  { endpoint: "Private verify", limit: "50/min", burst: "5/sec" },
];

const RESEARCH_EXCLUSIONS = [
  "No transcripts",
  "No receipt IDs",
  "No IPs",
  "No exact timestamps",
  "No PII values",
];

const AUDIT_ACTIONS = [
  "SAVED_VIEW_CREATED",
  "SAVED_VIEW_DELETED",
  "SAVED_VIEW_APPLIED",
  "EXPORT_REQUESTED",
  "EXPORT_CONFIRM_REQUIRED",
  "EXPORT_CONFIRMED",
  "EXPORT_QUEUED",
  "EXPORT_READY",
  "EXPORT_FAILED",
  "EXPORT_DOWNLOADED",
  "COMPARE_VIEWED",
  "RECEIPT_EXPORTED",
];

function getActionBadge(action: string) {
  if (action.startsWith("SAVED_VIEW")) return <Badge variant="outline" data-testid={`badge-action-${action}`}>{action}</Badge>;
  if (action.startsWith("EXPORT")) return <Badge variant="secondary" data-testid={`badge-action-${action}`}>{action}</Badge>;
  if (action === "COMPARE_VIEWED") return <Badge variant="outline" data-testid={`badge-action-${action}`}>{action}</Badge>;
  if (action === "RECEIPT_EXPORTED") return <Badge variant="secondary" data-testid={`badge-action-${action}`}>{action}</Badge>;
  return <Badge data-testid={`badge-action-${action}`}>{action}</Badge>;
}

function getTarget(event: AuditEvent): { label: string; link?: string } {
  if (event.receiptId) return { label: event.receiptId, link: `/receipts/${event.receiptId}` };
  if (event.exportId) return { label: event.exportId };
  if (event.savedViewId) return { label: event.savedViewId };
  return { label: "\u2014" };
}

function getSummary(event: AuditEvent): string {
  try {
    const p = JSON.parse(event.payload);
    if (p.name) return p.name;
    if (p.left && p.right) return `${p.left} vs ${p.right}`;
    if (p.scope) return `scope: ${p.scope}`;
    if (p.total !== undefined) return `${p.total} receipts`;
    if (p.error) return p.error;
    if (p.filters) return JSON.stringify(p.filters).slice(0, 80);
    return "\u2014";
  } catch {
    return "\u2014";
  }
}

function AuditIntegrityStrip() {
  const [verifyResult, setVerifyResult] = useState<AuditVerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runVerify = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/audit/verify");
      const data = await res.json();
      setVerifyResult(data);
    } catch {
      setVerifyResult(null);
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = verifyResult?.status === "BROKEN"
    ? <ShieldAlert className="h-4 w-4 text-destructive" />
    : <ShieldCheck className="h-4 w-4 text-green-600" />;

  const statusBadge = verifyResult ? (
    verifyResult.status === "BROKEN"
      ? <Badge variant="destructive" data-testid="badge-audit-integrity">{verifyResult.status}</Badge>
      : <Badge className="bg-green-600" data-testid="badge-audit-integrity">{verifyResult.status}</Badge>
  ) : null;

  return (
    <div className="flex items-center gap-3 mb-4 p-3 border rounded-md flex-wrap" data-testid="audit-integrity-strip">
      <div className="flex items-center gap-2">
        {verifyResult && statusIcon}
        <span className="text-sm font-medium">Audit Integrity</span>
        {statusBadge}
      </div>

      {verifyResult && (
        <span className="text-xs text-muted-foreground" data-testid="text-audit-checked">
          {verifyResult.partial
            ? `Verified seq 1\u2013${verifyResult.checked} of ${verifyResult.totalEvents} (first-N window)`
            : `${verifyResult.checked}/${verifyResult.totalEvents} event${verifyResult.totalEvents !== 1 ? "s" : ""} fully verified`}
          {verifyResult.head && <span className="ml-1">| head seq {verifyResult.head.seq}</span>}
        </span>
      )}

      {verifyResult?.status === "BROKEN" && verifyResult.break && (
        <span className="text-xs text-destructive" data-testid="text-audit-break">
          Break at seq {verifyResult.break.seq}: {verifyResult.break.reason}
        </span>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={runVerify}
        disabled={loading}
        className="ml-auto"
        data-testid="button-audit-verify"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        <span className="ml-1">Verify</span>
      </Button>

      {!verifyResult && (
        <p className="text-xs text-muted-foreground w-full mt-1">
          Hash-chained audit trail (v1.1). Each event is SHA-256 hashed with its predecessor, making unauthorized modifications, deletions, or reordering detectable. The payload version column (payload_v) is an optimization hint cross-checked against the hash-protected version embedded in the payload itself; even if a database administrator edits payload_v, verification will fail unless the underlying hash-protected payload version matches. Tamper-evidence is relative to the stored chain anchor; it does not protect against a fully-privileged database administrator who rewrites all rows and the head simultaneously. For stronger guarantees, anchor the head hash externally (e.g., signed checkpoint, WORM log, or third-party attestation).
        </p>
      )}
    </div>
  );
}

function AuditTrailSection() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [actionFilter, setActionFilter] = useState("all");
  const [receiptIdFilter, setReceiptIdFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (actionFilter !== "all") params.set("action", actionFilter);
  if (receiptIdFilter.trim()) params.set("receiptId", receiptIdFilter.trim());

  const queryUrl = `/api/audit?${params.toString()}`;

  const auditQuery = useQuery<AuditPagedResponse>({
    queryKey: [queryUrl],
  });

  if (auditQuery.error && isAuthError(auditQuery.error)) {
    return <AuthRequiredBanner title="Audit Trail" />;
  }

  const data = auditQuery.data;
  const totalPages = data?.totalPages ?? 1;

  const copyPayload = (event: AuditEvent) => {
    navigator.clipboard.writeText(event.payload).then(() => {
      setCopiedId(event.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="w-5 h-5" />
          Audit Trail
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AuditIntegrityStrip />

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[220px]" data-testid="select-audit-action">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {AUDIT_ACTIONS.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Filter by receipt ID"
            value={receiptIdFilter}
            onChange={(e) => { setReceiptIdFilter(e.target.value); setPage(1); }}
            className="w-[200px]"
            data-testid="input-audit-receipt-filter"
          />

          <Button
            size="icon"
            variant="ghost"
            onClick={() => auditQuery.refetch()}
            data-testid="button-audit-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${auditQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>

          {data && (
            <span className="text-sm text-muted-foreground ml-auto" data-testid="text-audit-count">
              {data.total} event{data.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {auditQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground" data-testid="text-audit-empty">
            No audit events recorded yet
          </div>
        ) : (
          <>
            <Table data-testid="table-audit-trail">
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((event) => {
                  const target = getTarget(event);
                  return (
                    <TableRow key={event.id} data-testid={`row-audit-${event.id}`}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(event.ts).toLocaleString()}
                      </TableCell>
                      <TableCell>{getActionBadge(event.action)}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[180px] truncate">
                        {target.link ? (
                          <Link href={target.link} className="underline" data-testid={`link-audit-target-${event.id}`}>
                            {target.label}
                          </Link>
                        ) : (
                          <span data-testid={`text-audit-target-${event.id}`}>{target.label}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[250px] truncate" data-testid={`text-audit-summary-${event.id}`}>
                        {getSummary(event)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => copyPayload(event)}
                          data-testid={`button-copy-audit-${event.id}`}
                        >
                          {copiedId === event.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-4 pt-3 flex-wrap">
                <span className="text-sm text-muted-foreground" data-testid="text-audit-page-info">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    data-testid="button-audit-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="button-audit-next"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Governance() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-600">ACTIVE</Badge>;
      case "REVOKED":
        return <Badge variant="destructive">REVOKED</Badge>;
      case "EXPIRED":
        return <Badge variant="secondary">EXPIRED</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6" data-testid="text-governance-title">Governance</h1>

      <div className="space-y-6">
        <AuditTrailSection />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Key Registry
              <Badge variant="outline" className="ml-2">Ed25519 only</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table data-testid="table-key-registry">
              <TableHeader>
                <TableRow>
                  <TableHead>key_id</TableHead>
                  <TableHead>issuer_label</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead>valid_from</TableHead>
                  <TableHead>valid_to</TableHead>
                  <TableHead>revoked_reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {KEY_REGISTRY.map((key) => (
                  <TableRow key={key.key_id} data-testid={`row-key-${key.key_id}`}>
                    <TableCell className="font-mono text-sm">{key.key_id}</TableCell>
                    <TableCell>{key.issuer_label}</TableCell>
                    <TableCell>{getStatusBadge(key.status)}</TableCell>
                    <TableCell>{key.valid_from}</TableCell>
                    <TableCell>{key.valid_to || "\u2014"}</TableCell>
                    <TableCell>{key.revoked_reason || "\u2014"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Rate Limits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table data-testid="table-rate-limits">
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Sustained Limit</TableHead>
                  <TableHead>Burst Limit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RATE_LIMITS.map((rl) => (
                  <TableRow key={rl.endpoint}>
                    <TableCell>{rl.endpoint}</TableCell>
                    <TableCell>{rl.limit}</TableCell>
                    <TableCell>{rl.burst}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Research Export
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Consent-based only</span>
            </div>

            <div>
              <h4 className="font-medium mb-2">Explicit Exclusions</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground" data-testid="list-exclusions">
                {RESEARCH_EXCLUSIONS.map((exclusion) => (
                  <li key={exclusion}>{exclusion}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

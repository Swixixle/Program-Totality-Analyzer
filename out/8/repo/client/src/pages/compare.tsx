import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, useSearch, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle,
  ArrowLeftRight, Eye, ExternalLink, Download,
  Search, Lock, Unlock, Loader2
} from "lucide-react";
import { AuthRequiredBanner, isAuthError } from "@/components/auth-required-banner";
import { parseForensics, type ForensicsFlags } from "@/lib/forensics";
import type { Receipt, Interpretation } from "@shared/schema";

interface ReceiptDetailResponse {
  receipt: Receipt;
  interpretations: Interpretation[];
  rawCapsule: Record<string, unknown>;
  transcriptMode?: "full" | "redacted" | "hidden";
}

function getVerificationBadge(status: string) {
  switch (status) {
    case "VERIFIED":
      return <Badge className="bg-green-600"><ShieldCheck className="h-3 w-3 mr-1" />VERIFIED</Badge>;
    case "PARTIALLY_VERIFIED":
      return <Badge className="bg-yellow-600"><ShieldAlert className="h-3 w-3 mr-1" />PARTIAL</Badge>;
    case "UNVERIFIED":
      return <Badge variant="destructive"><ShieldX className="h-3 w-3 mr-1" />UNVERIFIED</Badge>;
    default:
      return <Badge variant="secondary">{status || "\u2014"}</Badge>;
  }
}

function getSignatureBadge(status: string | null) {
  if (!status) return <span className="text-muted-foreground">{"\u2014"}</span>;
  switch (status) {
    case "VALID":
      return <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-400">VALID</Badge>;
    case "INVALID":
      return <Badge variant="destructive">INVALID</Badge>;
    case "UNTRUSTED_ISSUER":
      return <Badge variant="outline" className="border-yellow-600 text-yellow-700 dark:text-yellow-400">UNTRUSTED</Badge>;
    case "NO_SIGNATURE":
      return <Badge variant="secondary">NONE</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getChainBadge(status: string | null) {
  if (!status) return <span className="text-muted-foreground">{"\u2014"}</span>;
  switch (status) {
    case "GENESIS":
      return <Badge variant="outline" className="border-blue-600 text-blue-700 dark:text-blue-400">GENESIS</Badge>;
    case "LINKED":
      return <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-400">LINKED</Badge>;
    case "BROKEN":
      return <Badge variant="destructive">BROKEN</Badge>;
    case "NOT_CHECKED":
      return <Badge variant="secondary">NOT CHECKED</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function DiffIndicator({ same }: { same: boolean }) {
  if (same) {
    return <Badge variant="secondary" data-testid="badge-match">MATCH</Badge>;
  }
  return <Badge variant="destructive" data-testid="badge-diff">DIFF</Badge>;
}

function ForensicsChips({ flags }: { flags: ForensicsFlags | null }) {
  if (!flags) return <span className="text-muted-foreground">{"\u2014"}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={flags.pii ? "destructive" : "secondary"} className="text-xs">
        PII: {flags.piiCount}
      </Badge>
      <Badge variant={flags.risk ? "destructive" : "secondary"} className="text-xs">
        Risk: {flags.riskCount}
      </Badge>
      <Badge variant={flags.anom ? "destructive" : "secondary"} className="text-xs">
        Anomalies: {flags.anomCount}
      </Badge>
    </div>
  );
}

interface SideActionsProps {
  receiptId: string;
  receipt: Receipt;
}

function SideActions({ receiptId, receipt }: SideActionsProps) {
  const forensics = parseForensics(receipt.forensicsJson);

  const handleExport = () => {
    if (receipt.hindsightKillSwitch === 1 || forensics?.pii) {
      if (!confirm("This receipt has sensitive content (kill switch or PII). Proceed with export?")) return;
    }
    window.open(`/api/receipts/${encodeURIComponent(receiptId)}/export`, "_blank");
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/receipts/${receiptId}`}>
        <Button variant="outline" size="sm" data-testid={`button-view-detail-${receiptId}`}>
          <Eye className="h-3 w-3 mr-1" />
          View Detail
        </Button>
      </Link>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.open(`/api/public/receipts/${encodeURIComponent(receiptId)}/proof`, "_blank")}
        data-testid={`button-proof-pack-${receiptId}`}
      >
        <ExternalLink className="h-3 w-3 mr-1" />
        Proof Pack
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        data-testid={`button-export-${receiptId}`}
      >
        <Download className="h-3 w-3 mr-1" />
        Export
      </Button>
    </div>
  );
}

interface CompareField {
  label: string;
  key: string;
  leftValue: string;
  rightValue: string;
  leftBadge?: JSX.Element;
  rightBadge?: JSX.Element;
  isDiff: boolean;
}

function buildCompareFields(left: Receipt, right: Receipt): CompareField[] {
  const fields: CompareField[] = [];

  const add = (label: string, key: string, lv: string | null | undefined, rv: string | null | undefined, lBadge?: JSX.Element, rBadge?: JSX.Element) => {
    const l = lv ?? "\u2014";
    const r = rv ?? "\u2014";
    fields.push({ label, key, leftValue: l, rightValue: r, leftBadge: lBadge, rightBadge: rBadge, isDiff: l !== r });
  };

  add("Receipt ID", "receiptId", left.receiptId, right.receiptId);
  add("Created At", "createdAt", left.createdAt ? new Date(left.createdAt).toLocaleString() : null, right.createdAt ? new Date(right.createdAt).toLocaleString() : null);
  add("Verification", "verificationStatus", left.verificationStatus, right.verificationStatus, getVerificationBadge(left.verificationStatus), getVerificationBadge(right.verificationStatus));
  add("Signature", "signatureStatus", left.signatureStatus, right.signatureStatus, getSignatureBadge(left.signatureStatus), getSignatureBadge(right.signatureStatus));
  add("Chain", "chainStatus", left.chainStatus, right.chainStatus, getChainBadge(left.chainStatus), getChainBadge(right.chainStatus));
  add("Kill Switch", "killSwitch", left.hindsightKillSwitch === 1 ? "ENGAGED" : "OFF", right.hindsightKillSwitch === 1 ? "ENGAGED" : "OFF");
  add("Forensics", "hasForensics", left.forensicsJson ? "Yes" : "No", right.forensicsJson ? "Yes" : "No");
  add("Platform", "platform", left.platform, right.platform);
  add("Signer ID", "signerId", left.signatureIssuerId, right.signatureIssuerId);
  add("Engine", "engine", left.verificationEngineId, right.verificationEngineId);

  return fields;
}

export default function Compare() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);

  const [leftInput, setLeftInput] = useState(params.get("left") || "");
  const [rightInput, setRightInput] = useState(params.get("right") || "");

  const leftId = params.get("left") || "";
  const rightId = params.get("right") || "";

  const leftQuery = useQuery<ReceiptDetailResponse>({
    queryKey: ["/api/receipts", leftId],
    enabled: !!leftId,
  });

  const rightQuery = useQuery<ReceiptDetailResponse>({
    queryKey: ["/api/receipts", rightId],
    enabled: !!rightId,
  });

  const compareLoggedRef = useRef<string>("");
  useEffect(() => {
    if (leftId && rightId && leftQuery.data && rightQuery.data) {
      const key = `${leftId}|${rightId}`;
      if (compareLoggedRef.current !== key) {
        compareLoggedRef.current = key;
        apiRequest("POST", "/api/compare/viewed", { left: leftId, right: rightId }).catch(() => {});
      }
    }
  }, [leftId, rightId, leftQuery.data, rightQuery.data]);

  const leftAuthError = leftQuery.error && isAuthError(leftQuery.error);
  const rightAuthError = rightQuery.error && isAuthError(rightQuery.error);

  if (leftAuthError || rightAuthError) {
    return <AuthRequiredBanner title="Receipt Comparison" />;
  }

  const loadLeft = () => {
    const trimmed = leftInput.trim();
    if (!trimmed) return;
    const sp = new URLSearchParams(search);
    sp.set("left", trimmed);
    navigate(`/compare?${sp.toString()}`, { replace: true });
  };

  const loadRight = () => {
    const trimmed = rightInput.trim();
    if (!trimmed) return;
    const sp = new URLSearchParams(search);
    sp.set("right", trimmed);
    navigate(`/compare?${sp.toString()}`, { replace: true });
  };

  const swapSides = () => {
    const sp = new URLSearchParams();
    if (rightId) sp.set("left", rightId);
    if (leftId) sp.set("right", leftId);
    setLeftInput(rightId);
    setRightInput(leftId);
    navigate(`/compare?${sp.toString()}`, { replace: true });
  };

  const leftReceipt = leftQuery.data?.receipt;
  const rightReceipt = rightQuery.data?.receipt;

  const compareFields = useMemo(() => {
    if (!leftReceipt || !rightReceipt) return [];
    return buildCompareFields(leftReceipt, rightReceipt);
  }, [leftReceipt, rightReceipt]);

  const leftForensics = useMemo(() => leftReceipt ? parseForensics(leftReceipt.forensicsJson) : null, [leftReceipt]);
  const rightForensics = useMemo(() => rightReceipt ? parseForensics(rightReceipt.forensicsJson) : null, [rightReceipt]);

  const diffCount = compareFields.filter(f => f.isDiff).length;

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-4">
      <h1 className="text-2xl font-bold" data-testid="text-page-title">Receipt Comparison</h1>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Left Receipt</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter receipt ID..."
                  value={leftInput}
                  onChange={(e) => setLeftInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadLeft()}
                  data-testid="input-left-receipt"
                />
                <Button onClick={loadLeft} data-testid="button-load-left">
                  <Search className="h-4 w-4 mr-1" />
                  Load
                </Button>
              </div>
              {leftId && leftQuery.isLoading && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </div>
              )}
              {leftId && leftQuery.error && !leftAuthError && (
                <p className="text-sm text-destructive" data-testid="text-left-error">Receipt not found</p>
              )}
              {leftReceipt && (
                <div className="flex items-center gap-2 pt-1">
                  {getVerificationBadge(leftReceipt.verificationStatus)}
                  <span className="text-xs text-muted-foreground font-mono truncate">{leftReceipt.receiptId}</span>
                </div>
              )}
            </div>

            <Button variant="outline" size="icon" onClick={swapSides} data-testid="button-swap">
              <ArrowLeftRight className="h-4 w-4" />
            </Button>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Right Receipt</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter receipt ID..."
                  value={rightInput}
                  onChange={(e) => setRightInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadRight()}
                  data-testid="input-right-receipt"
                />
                <Button onClick={loadRight} data-testid="button-load-right">
                  <Search className="h-4 w-4 mr-1" />
                  Load
                </Button>
              </div>
              {rightId && rightQuery.isLoading && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </div>
              )}
              {rightId && rightQuery.error && !rightAuthError && (
                <p className="text-sm text-destructive" data-testid="text-right-error">Receipt not found</p>
              )}
              {rightReceipt && (
                <div className="flex items-center gap-2 pt-1">
                  {getVerificationBadge(rightReceipt.verificationStatus)}
                  <span className="text-xs text-muted-foreground font-mono truncate">{rightReceipt.receiptId}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!leftId && !rightId && (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-1" data-testid="text-empty-state">Select two receipts to compare</p>
            <p className="text-sm text-muted-foreground">
              Enter receipt IDs above, or use the "Compare..." action from the receipts table.
            </p>
          </CardContent>
        </Card>
      )}

      {leftReceipt && rightReceipt && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-lg">Summary</CardTitle>
                <Badge variant={diffCount > 0 ? "destructive" : "secondary"} data-testid="badge-diff-count">
                  {diffCount} difference{diffCount !== 1 ? "s" : ""} found
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-2 items-center">
                <div className="flex flex-wrap gap-2">
                  {getVerificationBadge(leftReceipt.verificationStatus)}
                  {getSignatureBadge(leftReceipt.signatureStatus)}
                  {getChainBadge(leftReceipt.chainStatus)}
                  {leftReceipt.hindsightKillSwitch === 1 ? (
                    <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" />KILL</Badge>
                  ) : (
                    <Badge variant="secondary"><Unlock className="h-3 w-3 mr-1" />OK</Badge>
                  )}
                </div>
                <div className="text-center text-xs text-muted-foreground">vs</div>
                <div className="flex flex-wrap gap-2">
                  {getVerificationBadge(rightReceipt.verificationStatus)}
                  {getSignatureBadge(rightReceipt.signatureStatus)}
                  {getChainBadge(rightReceipt.chainStatus)}
                  {rightReceipt.hindsightKillSwitch === 1 ? (
                    <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" />KILL</Badge>
                  ) : (
                    <Badge variant="secondary"><Unlock className="h-3 w-3 mr-1" />OK</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Field Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Field</TableHead>
                      <TableHead>Left</TableHead>
                      <TableHead>Right</TableHead>
                      <TableHead className="w-[80px] text-center">Delta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compareFields.map((field) => (
                      <TableRow key={field.key} data-testid={`row-compare-${field.key}`}>
                        <TableCell className="font-medium text-sm">{field.label}</TableCell>
                        <TableCell>
                          {field.leftBadge || (
                            <span className="text-sm font-mono break-all">{field.leftValue}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {field.rightBadge || (
                            <span className="text-sm font-mono break-all">{field.rightValue}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <DiffIndicator same={!field.isDiff} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Forensics Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-x-4 gap-y-2 items-start">
                <div data-testid="forensics-left">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Left</p>
                  <ForensicsChips flags={leftForensics} />
                </div>
                <div className="text-center pt-6">
                  <DiffIndicator same={
                    leftForensics?.piiCount === rightForensics?.piiCount &&
                    leftForensics?.riskCount === rightForensics?.riskCount &&
                    leftForensics?.anomCount === rightForensics?.anomCount
                  } />
                </div>
                <div data-testid="forensics-right">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Right</p>
                  <ForensicsChips flags={rightForensics} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Left Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <SideActions receiptId={leftReceipt.receiptId} receipt={leftReceipt} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Right Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <SideActions receiptId={rightReceipt.receiptId} receipt={rightReceipt} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {(leftId || rightId) && (!leftReceipt || !rightReceipt) && !leftQuery.isLoading && !rightQuery.isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <Search className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">
              {!leftReceipt && !rightReceipt
                ? "Load both receipts to begin comparison"
                : !leftReceipt
                  ? "Enter and load a left receipt ID to compare"
                  : "Enter and load a right receipt ID to compare"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

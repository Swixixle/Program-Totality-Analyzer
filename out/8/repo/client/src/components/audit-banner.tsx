import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, AlertTriangle, Loader2, RefreshCw, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AuditVerifyResponse {
  ok: boolean;
  status: "EMPTY" | "GENESIS" | "LINKED" | "BROKEN";
  checked: number;
  checkedEvents: number;
  totalEvents: number;
  partial: boolean;
  head: { seq: number; hash: string } | null;
  firstBadSeq: number | null;
  break: { seq: number; reason: string } | null;
}

interface ReadyResponse {
  status: "ok" | "degraded";
  ready: boolean;
  db: { ok: boolean };
  audit: { ok: boolean };
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function AuditBanner() {
  const [verifyData, setVerifyData] = useState<AuditVerifyResponse | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState(false);
  const [lastVerifyTime, setLastVerifyTime] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState("");

  const readyQuery = useQuery<ReadyResponse>({
    queryKey: ["/api/ready"],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const runVerify = useCallback(async () => {
    setVerifyLoading(true);
    setVerifyError(false);
    try {
      const res = await apiRequest("GET", "/api/audit/verify");
      const data = await res.json();
      setVerifyData(data);
      setLastVerifyTime(new Date());
    } catch {
      setVerifyError(true);
      setVerifyData(null);
    } finally {
      setVerifyLoading(false);
    }
  }, []);

  useEffect(() => {
    runVerify();
  }, [runVerify]);

  useEffect(() => {
    if (!lastVerifyTime) return;
    setTimeAgo(formatTimeAgo(lastVerifyTime));
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(lastVerifyTime));
    }, 30000);
    return () => clearInterval(interval);
  }, [lastVerifyTime]);

  const ready = readyQuery.data;
  const dbDegraded = ready && !ready.db.ok;
  const auditDegraded = ready && !ready.audit.ok;

  if (dbDegraded) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1 bg-destructive/10 text-destructive text-xs border-b"
        data-testid="banner-system-degraded"
      >
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>System degraded: database unreachable</span>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1 text-muted-foreground text-xs border-b"
        data-testid="banner-audit-error"
      >
        <ShieldAlert className="h-3 w-3 shrink-0" />
        <span>Audit check unavailable</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={runVerify}
          data-testid="button-banner-retry"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  if (verifyLoading && !verifyData) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1 text-muted-foreground text-xs border-b"
        data-testid="banner-audit-loading"
      >
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        <span>Verifying audit integrity...</span>
      </div>
    );
  }

  if (!verifyData) return null;

  const isBroken = verifyData.status === "BROKEN";
  const isPartial = verifyData.partial;
  const isEmpty = verifyData.status === "EMPTY";

  if (isEmpty) return null;

  const timestampEl = lastVerifyTime ? (
    <span className="text-muted-foreground/60 flex items-center gap-0.5" data-testid="text-last-verify-time">
      <Clock className="h-2.5 w-2.5" />
      {timeAgo}
    </span>
  ) : null;

  const refreshBtn = (
    <Button
      variant="ghost"
      size="icon"
      className="ml-auto"
      onClick={runVerify}
      disabled={verifyLoading}
      data-testid="button-banner-reverify"
    >
      {verifyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
    </Button>
  );

  if (isBroken) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1 bg-destructive/10 text-destructive text-xs border-b"
        data-testid="banner-audit-broken"
      >
        <ShieldAlert className="h-3 w-3 shrink-0" />
        <span>Verification failed at seq {verifyData.break?.seq}</span>
        <Badge variant="destructive">
          {verifyData.break?.reason}
        </Badge>
        {timestampEl}
        {refreshBtn}
      </div>
    );
  }

  if (auditDegraded && !isBroken) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1 text-xs border-b"
        data-testid="banner-audit-degraded"
      >
        <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400 shrink-0" />
        <span className="text-muted-foreground">
          Audit head degraded
        </span>
        <Badge variant="secondary">
          degraded
        </Badge>
        {timestampEl}
        {refreshBtn}
      </div>
    );
  }

  if (isPartial) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1 text-xs border-b"
        data-testid="banner-audit-partial"
      >
        <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400 shrink-0" />
        <span className="text-muted-foreground">
          Verified {verifyData.checked}/{verifyData.totalEvents} events
        </span>
        <Badge variant="secondary">
          partial
        </Badge>
        {timestampEl}
        {refreshBtn}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 text-xs border-b"
      data-testid="banner-audit-ok"
    >
      <ShieldCheck className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0" />
      <span className="text-muted-foreground">
        Verified {verifyData.checked}/{verifyData.totalEvents}
      </span>
      {timestampEl}
      {refreshBtn}
    </div>
  );
}

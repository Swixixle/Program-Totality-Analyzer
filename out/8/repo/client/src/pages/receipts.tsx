import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useVirtualizer } from "@tanstack/react-virtual";
import { apiRequest } from "@/lib/queryClient";
import { apiFetch } from "@/lib/apiFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck, ShieldAlert, ShieldX, Lock, Unlock, Search,
  MoreHorizontal, Eye, ExternalLink, Download, AlertTriangle,
  FileText, ArrowUpDown, RotateCcw, Copy, Check, RefreshCw, Clock,
  ChevronLeft, ChevronRight, Package, Loader2, Bookmark, BookmarkPlus,
  Settings2, Trash2, GitCompareArrows
} from "lucide-react";
import { AuthRequiredBanner, isAuthError } from "@/components/auth-required-banner";
import { useToast } from "@/hooks/use-toast";
import type { Receipt, SavedViewFilters } from "@shared/schema";
import { parseForensics, hasAnyForensicsFlags, type ForensicsFlags } from "@/lib/forensics";

interface PagedResponse {
  items: Receipt[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ROW_HEIGHT = 48;
const PAGE_SIZE_OPTIONS = [50, 100, 200];
const GRID_COLS = "200px 120px 110px 110px 120px 80px 100px 60px";

function buildPagedUrl(params: {
  page: number;
  pageSize: number;
  status: string;
  q: string;
  forensicsOnly: boolean;
  killSwitchOnly: boolean;
  order: string;
}): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  sp.set("order", params.order);
  if (params.status !== "all") sp.set("status", params.status);
  if (params.q.trim()) sp.set("q", params.q.trim());
  if (params.forensicsOnly) sp.set("hasForensics", "true");
  if (params.killSwitchOnly) sp.set("killSwitch", "true");
  return `/api/receipts/paged?${sp.toString()}`;
}

export default function Receipts() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [forensicsOnly, setForensicsOnly] = useState(false);
  const [killSwitchOnly, setKillSwitchOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportConfirm, setExportConfirm] = useState<{ receiptId: string; reason: string } | null>(null);
  const [bulkExportConfirm, setBulkExportConfirm] = useState<{ scope: "current_page" | "all_results"; piiCount: number; killCount: number } | null>(null);
  const [pendingExportBody, setPendingExportBody] = useState<Record<string, unknown> | null>(null);
  const [activeExportId, setActiveExportId] = useState<string | null>(null);
  const [exportPolling, setExportPolling] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [manageViewsOpen, setManageViewsOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewDescription, setViewDescription] = useState("");
  const [viewNameError, setViewNameError] = useState("");
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const pagedUrl = useMemo(() => buildPagedUrl({
    page,
    pageSize,
    status: statusFilter,
    q: debouncedSearch,
    forensicsOnly,
    killSwitchOnly,
    order: sortOrder,
  }), [page, pageSize, statusFilter, debouncedSearch, forensicsOnly, killSwitchOnly, sortOrder]);

  const { data, isLoading, error, dataUpdatedAt, isFetching } = useQuery<PagedResponse>({
    queryKey: [pagedUrl],
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [pagedUrl] });
  }, [queryClient, pagedUrl]);

  const forensicsCache = useMemo(() => {
    const map = new Map<string, ForensicsFlags | null>();
    for (const r of items) {
      map.set(r.id, parseForensics(r.forensicsJson));
    }
    return map;
  }, [items]);

  interface SavedViewResponse {
    id: string;
    name: string;
    description: string | null;
    filters: SavedViewFilters;
    createdAt: string;
    updatedAt: string;
  }

  const savedViewsQuery = useQuery<{ items: SavedViewResponse[] }>({
    queryKey: ["/api/saved-views"],
  });

  const savedViews = savedViewsQuery.data?.items ?? [];

  const saveViewMutation = useMutation({
    mutationFn: async (body: { name: string; description?: string | null; filters: SavedViewFilters }) => {
      const res = await apiFetch("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.status === 409 && json.error === "NAME_EXISTS") {
        throw new Error("NAME_EXISTS");
      }
      if (!res.ok) throw new Error(json.error || "Failed to save view");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-views"] });
      setSaveViewOpen(false);
      setViewName("");
      setViewDescription("");
      setViewNameError("");
      toast({ title: "Saved view created" });
    },
    onError: (err: Error) => {
      if (err.message === "NAME_EXISTS") {
        setViewNameError("A view with this name already exists");
      } else {
        toast({ title: "Failed to save view", variant: "destructive" });
      }
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/saved-views/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-views"] });
      toast({ title: "Saved view deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete view", variant: "destructive" });
    },
  });

  const applyView = useCallback((view: SavedViewResponse) => {
    const f = view.filters;
    setStatusFilter(f.status ?? "all");
    setSearchQuery(f.q ?? "");
    setDebouncedSearch(f.q ?? "");
    setForensicsOnly(f.hasForensics ?? false);
    setKillSwitchOnly(f.killSwitch ?? false);
    if (f.pageSize) setPageSize(f.pageSize);
    setPage(1);
    apiRequest("POST", `/api/saved-views/${view.id}/apply`).catch(() => {});
    toast({ title: `Applied view: ${view.name}` });
  }, [toast]);

  const handleSaveView = useCallback(() => {
    const name = viewName.trim();
    if (!name) {
      setViewNameError("Name is required");
      return;
    }
    if (name.length > 64) {
      setViewNameError("Name must be 64 characters or less");
      return;
    }
    setViewNameError("");
    const filters: SavedViewFilters = {
      status: statusFilter !== "all" ? statusFilter as any : null,
      q: debouncedSearch.trim() || null,
      hasForensics: forensicsOnly || null,
      killSwitch: killSwitchOnly || null,
      pageSize: pageSize as 50 | 100 | 200,
    };
    saveViewMutation.mutate({
      name,
      description: viewDescription.trim() || null,
      filters,
    });
  }, [viewName, viewDescription, statusFilter, debouncedSearch, forensicsOnly, killSwitchOnly, pageSize, saveViewMutation]);

  const bulkExportMutation = useMutation({
    mutationFn: async (body: { scope: "current_page" | "all_results"; page?: number; pageSize?: number; status?: string; q?: string; hasForensics?: boolean; killSwitch?: boolean; confirm?: boolean }) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const res = await apiFetch("/api/receipts/bulk-export", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        credentials: "include",
      });
      const json = await res.json();
      if (res.status === 409 && json.code === "CONFIRM_REQUIRED") {
        return { confirmRequired: true as const, riskCounts: json.riskCounts as { piiCount: number; killCount: number }, scope: body.scope, body };
      }
      if (!res.ok) {
        throw new Error(json.error || "Export failed");
      }
      return { confirmRequired: false as const, exportId: json.exportId as string, status: json.status as string };
    },
    onSuccess: (data) => {
      if (data.confirmRequired) {
        setBulkExportConfirm({ scope: data.scope, piiCount: data.riskCounts.piiCount, killCount: data.riskCounts.killCount });
        setPendingExportBody(data.body);
        return;
      }
      setActiveExportId(data.exportId);
      setExportPolling(true);
      toast({ title: "Export started" });
    },
    onError: () => {
      toast({ title: "Export failed", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!exportPolling || !activeExportId) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiRequest("GET", `/api/exports/${activeExportId}`);
        const job = await res.json() as { status: string; total: number; completed: number };
        if (job.status === "READY") {
          setExportPolling(false);
          toast({
            title: "Export ready",
            description: `${job.total} receipts exported`,
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`/api/exports/${activeExportId}/download`, "_blank");
                }}
                data-testid="button-download-export"
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            ),
          });
        } else if (job.status === "FAILED") {
          setExportPolling(false);
          toast({ title: "Export failed", variant: "destructive" });
        }
      } catch {
        setExportPolling(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [exportPolling, activeExportId, toast]);

  const buildExportBody = useCallback((scope: "current_page" | "all_results", confirmed?: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = { scope };
    if (scope === "current_page") {
      body.page = page;
      body.pageSize = pageSize;
    }
    if (statusFilter !== "all") body.status = statusFilter;
    if (debouncedSearch) body.q = debouncedSearch;
    if (forensicsOnly) body.hasForensics = true;
    if (killSwitchOnly) body.killSwitch = true;
    if (confirmed) body.confirm = true;
    return body;
  }, [page, pageSize, statusFilter, debouncedSearch, forensicsOnly, killSwitchOnly]);

  const handleBulkExport = useCallback((scope: "current_page" | "all_results") => {
    const body = buildExportBody(scope);
    bulkExportMutation.mutate(body as any);
  }, [buildExportBody, bulkExportMutation]);

  const confirmBulkExport = useCallback(() => {
    if (!pendingExportBody) return;
    const body = { ...pendingExportBody, confirm: true };
    setBulkExportConfirm(null);
    setPendingExportBody(null);
    bulkExportMutation.mutate(body as any);
  }, [pendingExportBody, bulkExportMutation]);

  const copyId = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
      toast({ title: "Copied receipt ID" });
    }).catch(() => {
      toast({ title: "Copy failed", variant: "destructive" });
    });
  }, [toast]);

  const handleFilterChange = useCallback(<T,>(setter: (v: T) => void) => {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setForensicsOnly(false);
    setKillSwitchOnly(false);
    setSortOrder("desc");
    setPage(1);
  }, []);

  const hasActiveFilters = debouncedSearch || statusFilter !== "all" || forensicsOnly || killSwitchOnly;

  const handleExportClick = useCallback((receiptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const receipt = items.find(r => r.receiptId === receiptId);
    if (!receipt) return;

    if (receipt.hindsightKillSwitch === 1) {
      setExportConfirm({ receiptId, reason: "kill_switch" });
      return;
    }

    const flags = forensicsCache.get(receipt.id);
    if (flags?.pii) {
      setExportConfirm({ receiptId, reason: "pii" });
      return;
    }

    window.open(`/api/receipts/${encodeURIComponent(receiptId)}/export`, "_blank");
  }, [items, forensicsCache]);

  const confirmExport = useCallback(() => {
    if (exportConfirm) {
      window.open(`/api/receipts/${encodeURIComponent(exportConfirm.receiptId)}/export`, "_blank");
      setExportConfirm(null);
    }
  }, [exportConfirm]);

  const getVerificationBadge = useCallback((status: string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-green-600" data-testid="badge-verified"><ShieldCheck className="h-3 w-3 mr-1" />VERIFIED</Badge>;
      case "PARTIALLY_VERIFIED":
        return <Badge className="bg-yellow-600" data-testid="badge-partial"><ShieldAlert className="h-3 w-3 mr-1" />PARTIAL</Badge>;
      case "UNVERIFIED":
        return <Badge variant="destructive" data-testid="badge-unverified"><ShieldX className="h-3 w-3 mr-1" />UNVERIFIED</Badge>;
      default:
        return <Badge variant="secondary">{status || "\u2014"}</Badge>;
    }
  }, []);

  const getSignatureBadge = useCallback((status: string | null) => {
    if (!status) return <span className="text-muted-foreground">{"\u2014"}</span>;
    switch (status) {
      case "VALID":
        return <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-400" data-testid="badge-sig-valid">VALID</Badge>;
      case "INVALID":
        return <Badge variant="destructive" data-testid="badge-sig-invalid">INVALID</Badge>;
      case "UNTRUSTED_ISSUER":
        return <Badge variant="outline" className="border-yellow-600 text-yellow-700 dark:text-yellow-400" data-testid="badge-sig-untrusted">UNTRUSTED</Badge>;
      case "NO_SIGNATURE":
        return <Badge variant="secondary" data-testid="badge-sig-none">NONE</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }, []);

  const getChainBadge = useCallback((status: string | null) => {
    if (!status) return <span className="text-muted-foreground">{"\u2014"}</span>;
    switch (status) {
      case "GENESIS":
        return <Badge variant="outline" className="border-blue-600 text-blue-700 dark:text-blue-400" data-testid="badge-chain-genesis">GENESIS</Badge>;
      case "LINKED":
        return <Badge variant="outline" className="border-green-600 text-green-700 dark:text-green-400" data-testid="badge-chain-linked">LINKED</Badge>;
      case "BROKEN":
        return <Badge variant="destructive" data-testid="badge-chain-broken">BROKEN</Badge>;
      case "NOT_CHECKED":
        return <Badge variant="secondary" data-testid="badge-chain-notchecked">NOT CHECKED</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }, []);

  const renderForensicsFlags = useCallback((flags: ForensicsFlags | null) => {
    if (!flags) return <span className="text-muted-foreground" data-testid="forensics-unknown">{"\u2014"}</span>;

    if (!flags.pii && !flags.risk && !flags.anom) {
      return <span className="text-muted-foreground text-xs" data-testid="forensics-clean">clean</span>;
    }

    return (
      <div className="flex items-center gap-1 flex-wrap" data-testid="forensics-flags">
        {flags.pii && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 dark:text-orange-400" data-testid="flag-pii">
                PII
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{flags.piiCount} PII indicator(s) detected</TooltipContent>
          </Tooltip>
        )}
        {flags.risk && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs border-red-500 text-red-600 dark:text-red-400" data-testid="flag-risk">
                RISK
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{flags.riskCount} risk category/categories flagged</TooltipContent>
          </Tooltip>
        )}
        {flags.anom && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs border-purple-500 text-purple-600 dark:text-purple-400" data-testid="flag-anom">
                ANOM
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{flags.anomCount} anomaly/anomalies detected</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }, []);

  if (error && isAuthError(error)) {
    return <AuthRequiredBanner title="Receipts" />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <h1 className="text-2xl font-bold mb-6" data-testid="text-receipts-title">Receipts</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <p className="text-destructive font-medium" data-testid="text-server-error">Failed to load receipts</p>
            <p className="text-sm text-muted-foreground mt-1">{(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-receipts-title">Receipts</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-last-updated">
              <Clock className="h-3 w-3" />
              {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isFetching}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-saved-views"
              >
                <Bookmark className="h-4 w-4 mr-1" />
                Views
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {savedViews.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground" data-testid="text-no-views">
                  No saved views yet
                </div>
              )}
              {savedViews.map((view) => (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => applyView(view)}
                  data-testid={`action-apply-view-${view.id}`}
                >
                  <Bookmark className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">{view.name}</span>
                </DropdownMenuItem>
              ))}
              <div className="border-t my-1" />
              <DropdownMenuItem
                onClick={() => {
                  setViewName("");
                  setViewDescription("");
                  setViewNameError("");
                  setSaveViewOpen(true);
                }}
                data-testid="action-save-current-view"
              >
                <BookmarkPlus className="h-4 w-4 mr-2" />
                Save current view...
              </DropdownMenuItem>
              {savedViews.length > 0 && (
                <DropdownMenuItem
                  onClick={() => setManageViewsOpen(true)}
                  data-testid="action-manage-views"
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Manage views...
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          {data && items.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkExportMutation.isPending || exportPolling}
                  data-testid="button-bulk-export"
                >
                  {exportPolling ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4 mr-1" />
                  )}
                  {exportPolling ? "Exporting..." : "Export"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleBulkExport("current_page")}
                  data-testid="action-export-page"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export this page ({items.length})
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleBulkExport("all_results")}
                  data-testid="action-export-all"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Export all results ({total})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {data && (
            <span className="text-sm text-muted-foreground" data-testid="text-results-count">
              Showing {items.length} of {total}
            </span>
          )}
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search receipt ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>

            <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="PARTIALLY_VERIFIED">Partially Verified</SelectItem>
                <SelectItem value="UNVERIFIED">Unverified</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                id="forensics-only"
                checked={forensicsOnly}
                onCheckedChange={handleFilterChange(setForensicsOnly)}
                data-testid="switch-forensics-only"
              />
              <Label htmlFor="forensics-only" className="text-sm whitespace-nowrap">Forensics only</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="kill-switch-only"
                checked={killSwitchOnly}
                onCheckedChange={handleFilterChange(setKillSwitchOnly)}
                data-testid="switch-kill-only"
              />
              <Label htmlFor="kill-switch-only" className="text-sm whitespace-nowrap">Kill switch only</Label>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} data-testid="button-reset-filters">
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-4">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-6 w-8" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            {total > 0 || hasActiveFilters ? (
              <div>
                <p className="text-lg font-medium mb-2">No matching receipts</p>
                <p className="text-sm text-muted-foreground mb-4">Try adjusting your filters</p>
                <Button variant="outline" onClick={resetFilters} data-testid="button-clear-filters">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2" data-testid="text-empty-state">No receipts yet</p>
                <p className="text-sm text-muted-foreground mb-4">Verify a receipt capsule to get started</p>
                <Link href="/verify">
                  <Button data-testid="button-verify-first">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Verify First Receipt
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <div
              data-testid="receipts-table"
              role="table"
              style={{ display: "grid", gridTemplateColumns: GRID_COLS }}
              className="text-sm border-b"
            >
              <div role="columnheader" data-testid="col-receipt-id" className="px-3 py-2 font-medium text-muted-foreground">Receipt ID</div>
              <div role="columnheader" data-testid="col-result" className="px-3 py-2 font-medium text-muted-foreground">Result</div>
              <div role="columnheader" data-testid="col-signature" className="px-3 py-2 font-medium text-muted-foreground">Signature</div>
              <div role="columnheader" data-testid="col-chain" className="px-3 py-2 font-medium text-muted-foreground">Chain</div>
              <div role="columnheader" data-testid="col-forensics" className="px-3 py-2 font-medium text-muted-foreground">Forensics</div>
              <div role="columnheader" data-testid="col-kill-switch" className="px-3 py-2 font-medium text-muted-foreground">Kill Switch</div>
              <div role="columnheader" data-testid="col-created" className="px-3 py-2 font-medium text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium"
                  onClick={() => {
                    setSortOrder(o => o === "desc" ? "asc" : "desc");
                    setPage(1);
                  }}
                >
                  Created
                  <ArrowUpDown className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <div role="columnheader" data-testid="col-actions" className="px-3 py-2 font-medium text-muted-foreground">Actions</div>
            </div>
          </div>
          <div
            ref={tableContainerRef}
            className="overflow-auto"
            style={{ maxHeight: "calc(100vh - 380px)", minHeight: "200px" }}
            data-testid="virtual-scroll-container"
          >
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const receipt = items[virtualRow.index];
                const flags = forensicsCache.get(receipt.id) ?? null;
                return (
                  <div
                    key={receipt.id}
                    role="row"
                    className="cursor-pointer hover-elevate border-b"
                    onClick={() => navigate(`/receipts/${receipt.receiptId}`)}
                    data-testid={`row-receipt-${receipt.receiptId}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: GRID_COLS,
                      alignItems: "center",
                      height: `${virtualRow.size}px`,
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div role="cell" className="px-3 font-mono text-xs overflow-hidden">
                      <div className="flex items-center gap-1">
                        <span className="truncate" data-testid={`text-id-${receipt.receiptId}`}>{receipt.receiptId}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => copyId(receipt.receiptId, e)}
                          data-testid={`button-copy-${receipt.receiptId}`}
                        >
                          {copiedId === receipt.receiptId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    <div role="cell" className="px-3">{getVerificationBadge(receipt.verificationStatus)}</div>
                    <div role="cell" className="px-3">{getSignatureBadge(receipt.signatureStatus)}</div>
                    <div role="cell" className="px-3">{getChainBadge(receipt.chainStatus)}</div>
                    <div role="cell" className="px-3">{renderForensicsFlags(flags)}</div>
                    <div role="cell" className="px-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span data-testid={`kill-switch-${receipt.receiptId}`}>
                            {receipt.hindsightKillSwitch === 1 ? (
                              <Lock className="h-4 w-4 text-destructive" />
                            ) : (
                              <Unlock className="h-4 w-4 text-muted-foreground" />
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {receipt.hindsightKillSwitch === 1 ? "Kill switch engaged" : "Kill switch off"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div role="cell" className="px-3 text-xs text-muted-foreground whitespace-nowrap">
                      {receipt.createdAt ? new Date(receipt.createdAt).toLocaleDateString() : "\u2014"}
                    </div>
                    <div role="cell" className="px-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" data-testid={`button-actions-${receipt.receiptId}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); navigate(`/receipts/${receipt.receiptId}`); }}
                            data-testid={`action-view-${receipt.receiptId}`}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/api/public/receipts/${encodeURIComponent(receipt.receiptId)}/proof`, "_blank");
                            }}
                            data-testid={`action-proof-${receipt.receiptId}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Proof
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => handleExportClick(receipt.receiptId, e)}
                            data-testid={`action-export-${receipt.receiptId}`}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Export
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); navigate(`/compare?left=${encodeURIComponent(receipt.receiptId)}`); }}
                            data-testid={`action-compare-${receipt.receiptId}`}
                          >
                            <GitCompareArrows className="h-4 w-4 mr-2" />
                            Compare...
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 p-3 border-t flex-wrap" data-testid="pagination-controls">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground" data-testid="text-page-info">
                Page {page} of {totalPages}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[100px]" data-testid="select-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map(s => (
                    <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <AlertDialog open={!!exportConfirm} onOpenChange={(open) => { if (!open) setExportConfirm(null); }}>
        <AlertDialogContent data-testid="dialog-export-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-export-title">
              Confirm Export
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-export-description">
              {exportConfirm?.reason === "pii"
                ? "This receipt contains detected PII. Exporting may increase exposure risk."
                : "Kill switch is engaged. Interpretation is blocked, but forensic export is permitted for evidence preservation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-export-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmExport} data-testid="button-export-confirm">
              Export anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={saveViewOpen} onOpenChange={(open) => { if (!open) { setSaveViewOpen(false); setViewNameError(""); } }}>
        <DialogContent data-testid="dialog-save-view">
          <DialogHeader>
            <DialogTitle data-testid="text-save-view-title">Save Current View</DialogTitle>
            <DialogDescription>
              Save the current filter settings as a named view for quick access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="view-name" className="text-sm font-medium">Name</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => { setViewName(e.target.value); setViewNameError(""); }}
                placeholder="e.g. Verified with PII"
                maxLength={64}
                data-testid="input-view-name"
              />
              {viewNameError && (
                <p className="text-sm text-destructive mt-1" data-testid="text-view-name-error">{viewNameError}</p>
              )}
            </div>
            <div>
              <Label htmlFor="view-description" className="text-sm font-medium">Description (optional)</Label>
              <Input
                id="view-description"
                value={viewDescription}
                onChange={(e) => setViewDescription(e.target.value)}
                placeholder="Brief description..."
                maxLength={200}
                data-testid="input-view-description"
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Current filters that will be saved:</p>
              <ul className="list-disc pl-4">
                {statusFilter !== "all" && <li>Status: {statusFilter}</li>}
                {debouncedSearch && <li>Search: {debouncedSearch}</li>}
                {forensicsOnly && <li>Forensics only</li>}
                {killSwitchOnly && <li>Kill switch only</li>}
                <li>Page size: {pageSize}</li>
                {!hasActiveFilters && statusFilter === "all" && <li>No filters (shows all receipts)</li>}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveViewOpen(false)} data-testid="button-cancel-save-view">Cancel</Button>
            <Button
              onClick={handleSaveView}
              disabled={saveViewMutation.isPending}
              data-testid="button-confirm-save-view"
            >
              {saveViewMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BookmarkPlus className="h-4 w-4 mr-1" />}
              Save View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageViewsOpen} onOpenChange={setManageViewsOpen}>
        <DialogContent data-testid="dialog-manage-views">
          <DialogHeader>
            <DialogTitle data-testid="text-manage-views-title">Manage Saved Views</DialogTitle>
            <DialogDescription>
              Delete saved views you no longer need.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
            {savedViews.map((view) => (
              <div key={view.id} className="flex items-center justify-between gap-2 p-2 rounded-md border" data-testid={`manage-view-${view.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" data-testid={`text-view-name-${view.id}`}>{view.name}</p>
                  {view.description && (
                    <p className="text-xs text-muted-foreground truncate">{view.description}</p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteViewMutation.mutate(view.id)}
                  disabled={deleteViewMutation.isPending}
                  data-testid={`button-delete-view-${view.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {savedViews.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-views-manage">
                No saved views to manage.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!bulkExportConfirm} onOpenChange={(open) => { if (!open) setBulkExportConfirm(null); }}>
        <AlertDialogContent data-testid="dialog-bulk-export-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-bulk-export-title">
              Confirm Bulk Export
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div data-testid="text-bulk-export-description">
                <p className="mb-2">This export includes receipts with sensitive flags:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {(bulkExportConfirm?.piiCount ?? 0) > 0 && (
                    <li data-testid="text-pii-count">PII detected: {bulkExportConfirm?.piiCount} receipt(s)</li>
                  )}
                  {(bulkExportConfirm?.killCount ?? 0) > 0 && (
                    <li data-testid="text-kill-count">Kill switch engaged: {bulkExportConfirm?.killCount} receipt(s)</li>
                  )}
                </ul>
                <p className="mt-2">Capsule data will be redacted for kill-switched receipts.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-bulk-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkExport}
              data-testid="button-bulk-confirm"
            >
              Export anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import {
  GitBranch, GitCommit, Clock, Play,
  CheckCircle2, XCircle, Loader2, RefreshCw,
  Activity, ExternalLink,
} from "lucide-react";
import { motion } from "framer-motion";

interface CiRun {
  id: string;
  repoOwner: string;
  repoName: string;
  ref: string;
  commitSha: string;
  eventType: string;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  outDir: string | null;
  summaryJson: any;
}

function CiStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; icon: React.ReactNode }> = {
    QUEUED: {
      className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      icon: <Clock className="w-3 h-3 mr-1" />,
    },
    RUNNING: {
      className: "bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse",
      icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" />,
    },
    SUCCEEDED: {
      className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
    },
    FAILED: {
      className: "bg-destructive/10 text-destructive border-destructive/20",
      icon: <XCircle className="w-3 h-3 mr-1" />,
    },
  };
  const c = config[status] || config.QUEUED;
  return (
    <Badge variant="outline" className={`no-default-hover-elevate no-default-active-elevate ${c.className} text-xs font-mono`} data-testid={`badge-ci-status-${status}`}>
      {c.icon}
      {status}
    </Badge>
  );
}

export default function CiFeed() {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [searchOwner, setSearchOwner] = useState("");
  const [searchRepo, setSearchRepo] = useState("");

  const hasSearch = searchOwner.length > 0 && searchRepo.length > 0;
  const hasActiveRuns = false;

  const { data, isLoading, refetch } = useQuery<{ ok: boolean; runs: CiRun[] }>({
    queryKey: ["/api/ci/runs", `?owner=${searchOwner}&repo=${searchRepo}&limit=50`],
    enabled: hasSearch,
    refetchInterval: hasActiveRuns ? 3000 : 10000,
  });

  const runs = data?.runs || [];
  const anyActive = runs.some((r) => r.status === "QUEUED" || r.status === "RUNNING");

  useEffect(() => {
    if (anyActive) {
      const interval = setInterval(() => refetch(), 3000);
      return () => clearInterval(interval);
    }
  }, [anyActive, refetch]);

  const [manualSha, setManualSha] = useState("");
  const [manualRef, setManualRef] = useState("main");

  const enqueue = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ci/enqueue", {
        owner: searchOwner,
        repo: searchRepo,
        ref: manualRef,
        commit_sha: manualSha,
        event_type: "manual",
      });
      return res.json();
    },
    onSuccess: () => {
      setManualSha("");
      queryClient.invalidateQueries({ queryKey: ["/api/ci/runs"] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchOwner(owner);
    setSearchRepo(repo);
  };

  const { data: health } = useQuery<{ ok: boolean; jobs: Record<string, number>; last_completed: any }>({
    queryKey: ["/api/ci/health"],
    refetchInterval: 15000,
  });

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-ci-feed-title">CI Feed</h1>
            <p className="text-muted-foreground mt-1">Live static analysis runs triggered by GitHub events.</p>
          </div>
          {health?.ok && (
            <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground" data-testid="text-ci-health">
              <Activity className="w-4 h-4 text-primary" />
              {Object.entries(health.jobs).map(([s, c]) => (
                <span key={s}>{s}: {c}</span>
              ))}
            </div>
          )}
        </div>

        <Card className="p-4 mb-6">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Owner</label>
              <Input
                data-testid="input-ci-owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="octocat"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Repository</label>
              <Input
                data-testid="input-ci-repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="hello-world"
              />
            </div>
            <Button type="submit" data-testid="button-ci-search">
              <RefreshCw className="w-4 h-4 mr-2" />
              Load Runs
            </Button>
          </form>
        </Card>

        {hasSearch && (
          <Card className="p-4 mb-6">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Commit SHA</label>
                <Input
                  data-testid="input-ci-sha"
                  value={manualSha}
                  onChange={(e) => setManualSha(e.target.value)}
                  placeholder="abc123..."
                />
              </div>
              <div className="min-w-[100px]">
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Ref</label>
                <Input
                  data-testid="input-ci-ref"
                  value={manualRef}
                  onChange={(e) => setManualRef(e.target.value)}
                  placeholder="main"
                />
              </div>
              <Button
                data-testid="button-ci-enqueue"
                variant="outline"
                onClick={() => enqueue.mutate()}
                disabled={!manualSha || enqueue.isPending}
              >
                <Play className="w-4 h-4 mr-2" />
                {enqueue.isPending ? "Enqueuing..." : "Manual Enqueue"}
              </Button>
            </div>
          </Card>
        )}

        {isLoading && hasSearch && (
          <div className="flex flex-col items-center justify-center h-[30vh] space-y-4">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-muted-foreground font-mono animate-pulse">Loading runs...</p>
          </div>
        )}

        {hasSearch && !isLoading && runs.length === 0 && (
          <div className="text-center py-20 border border-dashed border-border rounded-md">
            <p className="text-muted-foreground">No CI runs found for {searchOwner}/{searchRepo}.</p>
            <p className="text-xs text-muted-foreground mt-2">
              Configure a GitHub webhook or use manual enqueue to trigger runs.
            </p>
          </div>
        )}

        {!hasSearch && (
          <div className="text-center py-20 border border-dashed border-border rounded-md">
            <p className="text-muted-foreground">Enter a repository owner and name above to view CI runs.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {runs.map((run, i) => (
            <motion.div
              key={run.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card
                className="p-4 hover-elevate cursor-default"
                data-testid={`card-ci-run-${run.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <CiStatusBadge status={run.status} />
                    <span className="font-mono text-sm flex items-center gap-1 text-muted-foreground" data-testid={`text-ci-sha-${run.id}`}>
                      <GitCommit className="w-3.5 h-3.5" />
                      {run.commitSha.slice(0, 7)}
                    </span>
                    <span className="font-mono text-sm flex items-center gap-1 text-muted-foreground">
                      <GitBranch className="w-3.5 h-3.5" />
                      {run.ref}
                    </span>
                    <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate text-xs font-mono">
                      {run.eventType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                    </span>
                    {run.startedAt && run.finishedAt && (
                      <span>
                        {Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s
                      </span>
                    )}
                    {run.status === "SUCCEEDED" && run.outDir && (
                      <Link href={`/ci/runs/${run.id}`}>
                        <Button size="sm" variant="ghost" data-testid={`button-view-dossier-${run.id}`}>
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
                {run.error && (
                  <div className="mt-2 text-xs font-mono text-destructive bg-destructive/5 rounded-md p-2 break-all" data-testid={`text-ci-error-${run.id}`}>
                    {run.error}
                  </div>
                )}
                {run.summaryJson && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {run.summaryJson.boot_commands != null && (
                      <span className="text-xs font-mono text-muted-foreground">boot: {run.summaryJson.boot_commands}</span>
                    )}
                    {run.summaryJson.endpoints != null && (
                      <span className="text-xs font-mono text-muted-foreground">endpoints: {run.summaryJson.endpoints}</span>
                    )}
                    {run.summaryJson.gaps != null && (
                      <span className="text-xs font-mono text-muted-foreground">gaps: {run.summaryJson.gaps}</span>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-display font-semibold mb-4 text-foreground" data-testid="text-webhook-setup-title">Webhook Setup</h2>
          <Card className="p-4 font-mono text-sm space-y-3">
            <div>
              <span className="text-muted-foreground">URL:</span>{" "}
              <code className="text-primary" data-testid="text-webhook-url">
                {window.location.origin}/api/webhooks/github
              </code>
            </div>
            <div>
              <span className="text-muted-foreground">Content type:</span>{" "}
              <code>application/json</code>
            </div>
            <div>
              <span className="text-muted-foreground">Events:</span>{" "}
              <code>Push</code>, <code>Pull request</code>
            </div>
            <div>
              <span className="text-muted-foreground">Secret:</span>{" "}
              <code>Set GITHUB_WEBHOOK_SECRET env var</code>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

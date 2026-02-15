import { useRoute, Link } from "wouter";
import { useProject, useAnalysis } from "@/hooks/use-projects";
import { Layout } from "@/components/layout";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import {
  Loader2, AlertTriangle, FileText, CheckCircle, HelpCircle,
  ArrowLeft, Copy, Terminal, Plug, Rocket, Eye, Activity,
  ChevronDown, ChevronRight, Shield
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ProjectDetails() {
  const [match, params] = useRoute("/projects/:id");
  const projectId = parseInt(params?.id || "0");
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: analysis, isLoading: analysisLoading } = useAnalysis(projectId);

  if (projectLoading) return <LoadingScreen message="Loading project data..." />;
  
  if (!project) return (
    <Layout>
      <div className="text-center py-20">
        <h2 className="text-xl font-bold">Project Not Found</h2>
        <Link href="/"><div className="text-primary mt-4 cursor-pointer">Return Home</div></Link>
      </div>
    </Layout>
  );

  const isAnalyzing = project.status === 'analyzing' || project.status === 'pending';

  return (
    <Layout>
      <div className="max-w-7xl mx-auto h-full">
        <div className="mb-6 flex items-center gap-4">
          <Link href="/projects">
            <div className="p-2 rounded-full hover-elevate text-muted-foreground cursor-pointer" data-testid="link-back-projects">
              <ArrowLeft className="w-5 h-5" />
            </div>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-display font-bold" data-testid="text-project-name">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-1" data-testid="text-project-url">{project.url}</p>
          </div>
        </div>

        {isAnalyzing ? (
          <AnalyzingState />
        ) : project.status === 'failed' ? (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="pt-6 text-center text-destructive">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-lg font-bold mb-2">Analysis Failed</h3>
              <p>The system encountered an error while processing this repository.</p>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-4 gap-6"
            >
              <div className="lg:col-span-1 space-y-6">
                <Card className="bg-secondary/20 border-white/5">
                  <CardHeader>
                    <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Analysis Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <MetricItem label="Repo Name" value={project.name} />
                    <MetricItem label="Status" value={project.status} />
                    <MetricItem label="Analysis Date" value={new Date().toLocaleDateString()} />
                  </CardContent>
                </Card>

                {analysis?.unknowns && (() => {
                  const raw = analysis.unknowns as any;
                  const items: string[] = Array.isArray(raw)
                    ? raw.map((u: any) => typeof u === "string" ? u : u.what_is_missing || u.description || u.item || JSON.stringify(u))
                    : [];
                  if (!items.length) return null;
                  return (
                    <Card className="bg-yellow-500/5 border-yellow-500/10">
                      <CardHeader>
                        <CardTitle className="text-sm font-mono text-yellow-500 uppercase tracking-wider flex items-center gap-2">
                          <HelpCircle className="w-4 h-4" /> Unknowns
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="text-sm space-y-2 text-muted-foreground" data-testid="list-unknowns">
                          {items.map((u, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-yellow-500">-</span> {u}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>

              <div className="lg:col-span-3">
                <Tabs defaultValue="dossier" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-secondary/30" data-testid="tabs-analysis">
                    <TabsTrigger value="dossier" data-testid="tab-dossier">Dossier</TabsTrigger>
                    <TabsTrigger value="operate" data-testid="tab-operate">Operator Dashboard</TabsTrigger>
                    <TabsTrigger value="claims" data-testid="tab-claims">Claims Verification</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="dossier" className="mt-6">
                    <Card className="bg-background border-border">
                      <ScrollArea className="h-[800px] w-full rounded-md border p-6 md:p-10">
                        <article className="prose prose-invert prose-headings:font-display prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary max-w-none">
                          <ReactMarkdown>{analysis?.dossier || "*No dossier content generated.*"}</ReactMarkdown>
                        </article>
                      </ScrollArea>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="operate" className="mt-6">
                    <OperatorDashboard operate={analysis?.operate as any} />
                  </TabsContent>

                  <TabsContent value="claims" className="mt-6">
                    <div className="grid gap-4">
                      {(() => {
                        const raw = analysis?.claims as any;
                        const claims: any[] = Array.isArray(raw) ? raw : (raw?.claims && Array.isArray(raw.claims)) ? raw.claims : [];
                        if (!claims.length) return <p className="text-muted-foreground" data-testid="text-no-claims">No claims data available.</p>;

                        return claims.map((claim: any, i: number) => {
                          const isVerified = claim.verified === true || claim.status === "evidenced";
                          const title = claim.claim || claim.statement || "Claim";
                          const evidenceDisplay = Array.isArray(claim.evidence)
                            ? claim.evidence.map((ev: any) => ev.display || `${ev.path}:${ev.line_start}`).join(", ")
                            : typeof claim.evidence === "string" ? claim.evidence : "";
                          const confidence = typeof claim.confidence === "number" ? claim.confidence : null;

                          return (
                            <Card key={i} className="border-white/5 bg-secondary/10" data-testid={`card-claim-${i}`}>
                              <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                  <div className={cn(
                                    "p-2 rounded-lg mt-1",
                                    isVerified
                                      ? "bg-green-500/10 text-green-500"
                                      : "bg-red-500/10 text-red-500"
                                  )}>
                                    {isVerified ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                  </div>
                                  <div className="flex-1">
                                    <h3 className="text-lg font-semibold mb-1">{title}</h3>
                                    {evidenceDisplay && <p className="text-sm text-muted-foreground font-mono mb-3">{evidenceDisplay}</p>}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={cn(
                                        "text-xs font-bold px-2 py-0.5 rounded border uppercase tracking-wide",
                                        isVerified
                                          ? "border-green-500/20 text-green-500 bg-green-500/5"
                                          : "border-red-500/20 text-red-500 bg-red-500/5"
                                      )}>
                                        {isVerified ? "VERIFIED" : "UNVERIFIED"}
                                      </span>
                                      {confidence !== null && (
                                        <span className="text-xs font-mono text-muted-foreground">
                                          Confidence: {(confidence * 100).toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        });
                      })()}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </Layout>
  );
}

function ReadinessBar({ label, score, icon: Icon }: { label: string; score: number; icon: any }) {
  const color = score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  const textColor = score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="space-y-1.5" data-testid={`readiness-${label.toLowerCase()}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", textColor)} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={cn("text-sm font-mono font-bold", textColor)}>{score}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function CopyableCommand({ command, label }: { command: string; label?: string }) {
  const { toast } = useToast();
  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(command).then(() => {
      toast({ title: "Copied", description: "Command copied to clipboard" });
    });
  }, [command, toast]);

  return (
    <div className="group flex items-center gap-2 bg-secondary/40 rounded-md border border-border overflow-hidden">
      {label && <span className="text-xs text-muted-foreground px-3 py-2 border-r border-border shrink-0">{label}</span>}
      <code className="flex-1 text-sm font-mono text-primary/80 px-3 py-2 truncate" data-testid="text-command">{command}</code>
      <Button
        size="icon"
        variant="ghost"
        onClick={copyToClipboard}
        className="shrink-0 mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid="button-copy-command"
      >
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function EvidenceTag({ evidence }: { evidence: any[] }) {
  if (!evidence || !evidence.length) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      {evidence.map((ev: any, i: number) => (
        <span key={i} className="text-xs font-mono text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded" data-testid={`evidence-tag-${i}`}>
          {ev.display || `${ev.path}:${ev.line_start}`}
        </span>
      ))}
    </div>
  );
}

function getTier(item: any): string {
  return item?.tier || item?.status || "UNKNOWN";
}

function TierBadge({ tier }: { tier: string }) {
  const config: Record<string, { className: string; label: string }> = {
    EVIDENCED: { className: "border-green-500/20 text-green-500 bg-green-500/5", label: "EVIDENCED" },
    INFERRED: { className: "border-blue-500/20 text-blue-500 bg-blue-500/5", label: "INFERRED" },
    UNKNOWN: { className: "border-yellow-500/20 text-yellow-500 bg-yellow-500/5", label: "UNKNOWN" },
  };
  const c = config[tier] || config.UNKNOWN;
  return (
    <Badge variant="outline" className={cn("text-[10px] font-mono no-default-hover-elevate no-default-active-elevate", c.className)} data-testid={`badge-tier-${tier.toLowerCase()}`}>
      {c.label}
    </Badge>
  );
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false, count }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean; count?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-md overflow-visible">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover-elevate"
        data-testid={`button-section-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <Icon className="w-4 h-4 text-primary shrink-0" />
        <span className="font-medium text-sm flex-1">{title}</span>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground font-mono">{count} items</span>
        )}
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">{children}</div>}
    </div>
  );
}

function OperatorDashboard({ operate }: { operate: any }) {
  if (!operate || !operate.boot) {
    return (
      <Card className="bg-background border-border p-6">
        <div className="text-center py-12 text-muted-foreground" data-testid="text-no-operate">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium mb-1">No operator data available</p>
          <p className="text-sm">Run the analyzer to generate the operator dashboard.</p>
        </div>
      </Card>
    );
  }

  const { boot, integrate, deploy, readiness, gaps, runbooks, snapshot } = operate;

  return (
    <div className="space-y-6" data-testid="operator-dashboard">
      <Card className="bg-background border-border p-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border mb-6">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold" data-testid="text-dashboard-title">Operator Dashboard</h2>
            <p className="text-sm text-muted-foreground">Deterministic operational intelligence from static artifacts</p>
          </div>
        </div>

        {readiness && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6" data-testid="readiness-scores">
            <ReadinessBar label="Boot" score={readiness.boot?.score ?? 0} icon={Terminal} />
            <ReadinessBar label="Integration" score={readiness.integration?.score ?? 0} icon={Plug} />
            <ReadinessBar label="Deployment" score={readiness.deployment?.score ?? 0} icon={Rocket} />
            <ReadinessBar label="Observability" score={readiness.observability?.score ?? 0} icon={Eye} />
          </div>
        )}

        {gaps && gaps.length > 0 && (
          <div className="space-y-3 mb-6" data-testid="gaps-section">
            <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Operational Gaps</h3>
            <div className="grid gap-3">
              {gaps.map((gap: any, i: number) => (
                <Card key={i} className="bg-red-500/5 border-red-500/10" data-testid={`card-gap-${i}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-red-500/10 rounded-md text-red-500 mt-0.5">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm">{gap.title}</span>
                          <TierBadge tier="UNKNOWN" />
                          {gap.severity && (
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-mono no-default-hover-elevate no-default-active-elevate",
                              (gap.severity === "high" || gap.severity === "blocker") ? "border-red-500/20 text-red-500" :
                              gap.severity === "medium" ? "border-yellow-500/20 text-yellow-500" :
                              "border-muted-foreground/20 text-muted-foreground"
                            )}>
                              {gap.severity.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                        {(gap.recommendation || gap.action) && <p className="text-sm text-muted-foreground">{gap.recommendation || gap.action}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <CollapsibleSection title="Boot Sequence" icon={Terminal} defaultOpen={true} count={(boot.install?.length ?? 0) + (boot.dev?.length ?? 0) + (boot.prod?.length ?? 0)}>
          {boot.install?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Install</h4>
              {boot.install.map((item: any, i: number) => (
                <div key={i} className="space-y-1" data-testid={`boot-install-${i}`}>
                  <CopyableCommand command={item.command} />
                  <div className="flex items-center gap-2">
                    <TierBadge tier={getTier(item)} />
                    <EvidenceTag evidence={item.evidence} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {boot.dev?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Dev Server</h4>
              {boot.dev.map((item: any, i: number) => (
                <div key={i} className="space-y-1" data-testid={`boot-dev-${i}`}>
                  <CopyableCommand command={item.command} />
                  <div className="flex items-center gap-2">
                    <TierBadge tier={getTier(item)} />
                    <EvidenceTag evidence={item.evidence} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {boot.prod?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Production</h4>
              {boot.prod.map((item: any, i: number) => (
                <div key={i} className="space-y-1" data-testid={`boot-prod-${i}`}>
                  <CopyableCommand command={item.command} />
                  <div className="flex items-center gap-2">
                    <TierBadge tier={getTier(item)} />
                    <EvidenceTag evidence={item.evidence} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {boot.ports?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Ports</h4>
              {boot.ports.map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3" data-testid={`boot-port-${i}`}>
                  <span className="font-mono text-sm text-primary">{item.port || item.value}</span>
                  {item.protocol && <span className="text-xs text-muted-foreground">{item.protocol}</span>}
                  {item.uses_env_port && <span className="text-xs text-muted-foreground">via env PORT</span>}
                  <TierBadge tier={getTier(item)} />
                  <EvidenceTag evidence={item.evidence} />
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Integration Points" icon={Plug} count={(integrate?.endpoints?.length ?? 0) + (integrate?.env_vars?.length ?? 0)}>
          {integrate?.endpoints?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">API Endpoints</h4>
              <div className="space-y-1.5">
                {integrate.endpoints.map((ep: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap" data-testid={`endpoint-${i}`}>
                    <Badge variant="outline" className="font-mono text-[10px] no-default-hover-elevate no-default-active-elevate">{ep.method}</Badge>
                    <span className="font-mono text-sm">{ep.path}</span>
                    <TierBadge tier={getTier(ep)} />
                    <EvidenceTag evidence={ep.evidence} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {integrate?.env_vars?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Environment Variables</h4>
              <div className="space-y-1.5">
                {integrate.env_vars.map((ev: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap" data-testid={`env-var-${i}`}>
                    <code className="text-sm font-mono text-primary/80 bg-secondary/40 px-1.5 py-0.5 rounded">{ev.name || ev.value}</code>
                    {ev.required && <span className="text-[10px] text-red-400 font-mono">REQUIRED</span>}
                    {ev.source && <span className="text-xs text-muted-foreground">{ev.source}</span>}
                    <TierBadge tier={getTier(ev)} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {integrate?.auth?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Auth / Middleware
              </h4>
              <div className="space-y-1.5">
                {integrate.auth.map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap" data-testid={`auth-${i}`}>
                    <span className="text-sm">{a.name || a.type}</span>
                    <TierBadge tier={getTier(a)} />
                    <EvidenceTag evidence={a.evidence} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CollapsibleSection>

        <CollapsibleSection title="Deployment" icon={Rocket} count={(deploy?.platform?.length ?? 0) + (deploy?.ci?.length ?? 0)}>
          {deploy?.platform?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Platform</h4>
              {deploy.platform.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2 flex-wrap" data-testid={`deploy-platform-${i}`}>
                  <span className="text-sm font-medium">{p.name}</span>
                  <TierBadge tier={getTier(p)} />
                  {p.unknown_reason && <span className="text-xs text-yellow-500">{p.unknown_reason}</span>}
                  <EvidenceTag evidence={p.evidence} />
                </div>
              ))}
            </div>
          )}
          {deploy?.ci?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">CI/CD</h4>
              {deploy.ci.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 flex-wrap" data-testid={`deploy-ci-${i}`}>
                  <span className="text-sm font-medium">{c.name}</span>
                  <TierBadge tier={getTier(c)} />
                  <EvidenceTag evidence={c.evidence} />
                </div>
              ))}
            </div>
          )}
          {deploy?.containerization?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Containerization</h4>
              {deploy.containerization.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 flex-wrap" data-testid={`deploy-container-${i}`}>
                  <span className="text-sm font-medium">{c.name}</span>
                  <TierBadge tier={getTier(c)} />
                  {c.unknown_reason && <span className="text-xs text-yellow-500">{c.unknown_reason}</span>}
                  <EvidenceTag evidence={c.evidence} />
                </div>
              ))}
            </div>
          )}
        </CollapsibleSection>

        {runbooks && (
          <CollapsibleSection
            title="Runbooks"
            icon={FileText}
            count={Object.values(runbooks).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0) as number}
          >
            {Object.entries(runbooks).map(([category, steps]: [string, any]) => {
              if (!Array.isArray(steps) || !steps.length) return null;
              const label = category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider">{label}</h4>
                  {steps.map((step: any, i: number) => (
                    <div key={i} className="space-y-1" data-testid={`runbook-${category}-${i}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground w-5">{step.order || step.step}.</span>
                        <span className="text-sm">{step.title || step.action}</span>
                        <TierBadge tier={getTier(step)} />
                      </div>
                      {step.command && <CopyableCommand command={step.command} />}
                      {step.note && <p className="text-xs text-muted-foreground pl-7">{step.note}</p>}
                    </div>
                  ))}
                </div>
              );
            })}
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="font-mono text-sm font-medium">{value}</div>
    </div>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <Layout>
      <div className="h-[60vh] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-mono animate-pulse">{message}</p>
      </div>
    </Layout>
  );
}

function AnalyzingState() {
  const steps = [
    "Cloning repository...",
    "Scanning file structure...",
    "Analyzing dependencies...",
    "Synthesizing codebase patterns...",
    "Generating dossier..."
  ];

  return (
    <div className="h-[600px] flex flex-col items-center justify-center text-center">
      <div className="relative w-32 h-32 mb-8">
        <div className="absolute inset-0 border-4 border-secondary rounded-full" />
        <div className="absolute inset-0 border-4 border-t-primary border-r-primary rounded-full animate-spin" />
        <div className="absolute inset-4 bg-secondary/30 rounded-full blur-xl animate-pulse" />
      </div>
      
      <h2 className="text-2xl font-display font-bold mb-2">Analysis in Progress</h2>
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        The Totality Engine is deconstructing the codebase. This process usually takes 1-2 minutes.
      </p>

      <div className="w-full max-w-sm space-y-3 font-mono text-xs text-left bg-secondary/20 p-6 rounded-lg border border-white/5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
             <span className="text-primary/80">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

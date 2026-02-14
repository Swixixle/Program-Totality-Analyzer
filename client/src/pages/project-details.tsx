import { useRoute, Link } from "wouter";
import { useProject, useAnalysis } from "@/hooks/use-projects";
import { Layout } from "@/components/layout";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { Loader2, AlertTriangle, FileText, CheckCircle, HelpCircle, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
            <div className="p-2 rounded-full hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </div>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-sm text-muted-foreground font-mono mt-1">{project.url}</p>
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
              {/* Sidebar Metrics */}
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

                {analysis?.unknowns && (
                  <Card className="bg-yellow-500/5 border-yellow-500/10">
                    <CardHeader>
                      <CardTitle className="text-sm font-mono text-yellow-500 uppercase tracking-wider flex items-center gap-2">
                        <HelpCircle className="w-4 h-4" /> Unknowns
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-2 text-muted-foreground">
                        {(analysis.unknowns as string[]).map((u, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-yellow-500">•</span> {u}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Main Content */}
              <div className="lg:col-span-3">
                <Tabs defaultValue="dossier" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-secondary/30">
                    <TabsTrigger value="dossier">Dossier</TabsTrigger>
                    <TabsTrigger value="howto">How To Guide</TabsTrigger>
                    <TabsTrigger value="claims">Claims Verification</TabsTrigger>
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
                  
                  <TabsContent value="howto" className="mt-6">
                    <Card className="bg-background border-border p-6">
                      <div className="space-y-8">
                        <div className="flex items-center gap-3 pb-4 border-b border-border">
                          <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold">Execution Guide</h2>
                            <p className="text-sm text-muted-foreground">Step-by-step operational instructions</p>
                          </div>
                        </div>
                        
                        <div className="space-y-6">
                          {analysis?.howto && (analysis.howto as any[]).map((step: any, i: number) => (
                            <div key={i} className="flex gap-4">
                              <div className="flex-none flex flex-col items-center">
                                <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center font-mono text-sm font-bold text-primary">
                                  {i + 1}
                                </div>
                                {i !== (analysis.howto as any[]).length - 1 && (
                                  <div className="w-px h-full bg-border mt-2" />
                                )}
                              </div>
                              <div className="flex-1 pb-6">
                                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                                <p className="text-muted-foreground mb-3">{step.description}</p>
                                {step.code && (
                                  <pre className="bg-secondary/40 p-3 rounded-lg border border-white/5 font-mono text-sm text-primary/80 overflow-x-auto">
                                    {step.code}
                                  </pre>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </TabsContent>

                  <TabsContent value="claims" className="mt-6">
                    <div className="grid gap-4">
                      {analysis?.claims && (analysis.claims as any[]).map((claim: any, i: number) => (
                        <Card key={i} className="border-white/5 bg-secondary/10">
                          <CardContent className="pt-6">
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                "p-2 rounded-lg mt-1",
                                claim.verified 
                                  ? "bg-green-500/10 text-green-500" 
                                  : "bg-red-500/10 text-red-500"
                              )}>
                                {claim.verified ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                              </div>
                              <div>
                                <h3 className="text-lg font-semibold mb-1">{claim.claim}</h3>
                                <p className="text-sm text-muted-foreground mb-3">{claim.evidence}</p>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-xs font-bold px-2 py-0.5 rounded border uppercase tracking-wide",
                                    claim.verified 
                                      ? "border-green-500/20 text-green-500 bg-green-500/5" 
                                      : "border-red-500/20 text-red-500 bg-red-500/5"
                                  )}>
                                    {claim.verified ? "VERIFIED" : "UNVERIFIED"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
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

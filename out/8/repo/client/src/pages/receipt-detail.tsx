import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { HaloHeader } from "@/components/halo-header";
import { 
  Shield, ArrowLeft, ShieldCheck, ShieldAlert, ShieldX, Lock, AlertTriangle, 
  Hash, Key, FileText, MessageSquare, Lightbulb, HelpCircle, Cpu, Power, Copy, Layers,
  BarChart2, Clock, Code, AlertOctagon, User, Download, EyeOff, ExternalLink
} from "lucide-react";
import { AuthRequiredBanner, isAuthError } from "@/components/auth-required-banner";
import type { Receipt, Interpretation, TriSensorResult, ForensicsResult } from "@shared/schema";

interface ReceiptDetail {
  receipt: Receipt;
  interpretations: Interpretation[];
  rawCapsule: Record<string, unknown>;
  transcriptMode?: "full" | "redacted" | "hidden";
}

export default function ReceiptDetail() {
  const { receiptId } = useParams<{ receiptId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [interpretQuestion, setInterpretQuestion] = useState("");
  const [interpretKind, setInterpretKind] = useState<"fact" | "interpretation" | "uncertainty">("interpretation");
  const [killSwitchDialogOpen, setKillSwitchDialogOpen] = useState(false);

  const { data, isLoading, error } = useQuery<ReceiptDetail>({
    queryKey: ["/api/receipts", receiptId],
    enabled: !!receiptId,
  });

  const killSwitchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/receipts/${receiptId}/kill`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Kill Switch Engaged", description: "Interpretation is now permanently disabled for this receipt." });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      setKillSwitchDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const interpretMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/receipts/${receiptId}/interpret`, {
        schema: "ai-receipt/interpret-request/1.0",
        model_id: "stub:v1",
        prompt_mode: "forensic",
        question: interpretQuestion,
        kind: interpretKind,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Interpretation Added" });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
      setInterpretQuestion("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const triSensorMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/receipts/${receiptId}/tri-sensor`, {});
      return res.json() as Promise<TriSensorResult>;
    },
    onSuccess: () => {
      toast({ title: "Tri-Sensor Analysis Complete" });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts", receiptId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const copyReceiptId = () => {
    if (!receiptId) return;
    navigator.clipboard.writeText(receiptId).then(() => {
      toast({ title: "Copied receipt ID" });
    }).catch(() => {
      toast({ title: "Copy failed", variant: "destructive" });
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied to clipboard" });
    }).catch(() => {
      toast({ title: "Copy failed", variant: "destructive" });
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-accent text-accent-foreground"><ShieldCheck className="h-3 w-3 mr-1" />VERIFIED</Badge>;
      case "PARTIALLY_VERIFIED":
        return <Badge className="bg-yellow-500 text-white"><ShieldAlert className="h-3 w-3 mr-1" />PARTIALLY VERIFIED</Badge>;
      case "UNVERIFIED":
        return <Badge variant="destructive"><ShieldX className="h-3 w-3 mr-1" />UNVERIFIED</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canInterpret = data?.receipt && 
    data.receipt.verificationStatus !== "UNVERIFIED" && 
    data.receipt.hindsightKillSwitch !== 1;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight">AI Receipts</h1>
                <p className="text-sm text-muted-foreground">Forensic Verification System</p>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (error && isAuthError(error)) {
    return <AuthRequiredBanner title="Receipt Detail" />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-medium mb-2">Receipt Not Found</p>
            <p className="text-sm text-muted-foreground mb-4">The requested receipt could not be found.</p>
            <Link href="/receipts">
              <Button><ArrowLeft className="h-4 w-4 mr-2" />Back to Receipts</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { receipt, interpretations, rawCapsule } = data;
  const facts = interpretations.filter(i => i.kind === "fact");
  const interps = interpretations.filter(i => i.kind === "interpretation");
  const uncertainties = interpretations.filter(i => i.kind === "uncertainty");
  const triSensors = interpretations.filter(i => i.kind === "tri_sensor");
  
  const forensics: ForensicsResult | null = receipt.forensicsJson 
    ? JSON.parse(receipt.forensicsJson) 
    : null;

  const riskSummary = (() => {
    if (!forensics) return null;
    const piiFields = ["email_like_count", "phone_like_count", "ssn_like_count", "dob_like_count", "mrn_like_count", "ip_like_count"];
    let piiCount = 0;
    if (forensics.pii_heuristics) {
      for (const k of piiFields) {
        const val = (forensics.pii_heuristics as unknown as Record<string, number>)[k];
        if (typeof val === "number" && val > 0) piiCount += val;
      }
    }
    const riskCategories = ["instructional", "medical", "legal", "financial", "self_harm"];
    let riskCount = 0;
    if (forensics.risk_keywords) {
      for (const k of riskCategories) {
        if ((forensics.risk_keywords as Record<string, { present: boolean }>)[k]?.present) riskCount++;
      }
    }
    const anomCount = Array.isArray(forensics.anomalies) ? forensics.anomalies.length : 0;
    return { piiCount, riskCount, anomCount };
  })();

  return (
    <div className="min-h-screen bg-background">
      <HaloHeader
        killSwitchEngaged={receipt.hindsightKillSwitch === 1}
        verificationStatus={receipt.verificationStatus as "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED"}
        transcriptMode={data.transcriptMode || "full"}
        eventLogHash={receipt.computedHashSha256}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  {receipt.verificationStatus === "VERIFIED" ? (
                    <ShieldCheck className="h-6 w-6 text-accent" />
                  ) : receipt.verificationStatus === "PARTIALLY_VERIFIED" ? (
                    <ShieldAlert className="h-6 w-6 text-yellow-500" />
                  ) : (
                    <ShieldX className="h-6 w-6 text-destructive" />
                  )}
                  <div>
                    <CardTitle data-testid="text-receipt-title">Receipt Detail</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1 flex items-center gap-1" data-testid="text-receipt-id">
                      <span>{receipt.receiptId}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 shrink-0"
                        onClick={copyReceiptId}
                        data-testid="button-copy-receipt-id"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {receipt.hindsightKillSwitch === 1 && (
                    <Badge variant="destructive" data-testid="badge-kill-switch">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      KILL SWITCH ENGAGED
                    </Badge>
                  )}
                  {receipt.immutableLock === 1 && (
                    <Badge variant="secondary">
                      <Lock className="h-3 w-3 mr-1" />
                      IMMUTABLE
                    </Badge>
                  )}
                  {getStatusBadge(receipt.verificationStatus)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Platform</p>
                  <p className="font-medium">{receipt.platform}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Captured At</p>
                  <p className="font-medium">{new Date(receipt.capturedAt).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Verified At</p>
                  <p className="font-medium">{new Date(receipt.verifiedAt).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Engine</p>
                  <p className="font-mono text-sm">{receipt.verificationEngineId}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Hash className="h-4 w-4" />
                    <span>Expected Hash</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all flex-1" data-testid="text-expected-hash">
                      {receipt.expectedHashSha256}
                    </code>
                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(receipt.expectedHashSha256)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Hash className="h-4 w-4" />
                    <span>Computed Hash</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded break-all flex-1" data-testid="text-computed-hash">
                      {receipt.computedHashSha256}
                    </code>
                    <Button size="icon" variant="ghost" onClick={() => copyToClipboard(receipt.computedHashSha256)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <Badge variant={receipt.hashMatch === 1 ? "default" : "destructive"} className={receipt.hashMatch === 1 ? "bg-accent" : ""} data-testid="badge-hash-match">
                  {receipt.hashMatch === 1 ? "HASH MATCH" : "HASH MISMATCH"}
                </Badge>
                <div className="flex items-center gap-2 text-sm">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" data-testid="badge-signature-status">{receipt.signatureStatus}</Badge>
                  {receipt.signatureReason && (
                    <span className="text-xs text-muted-foreground">{receipt.signatureReason}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-3 flex-wrap" data-testid="risk-summary-strip">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">Risk Summary</span>
              {riskSummary ? (
                <>
                  <Badge
                    variant="outline"
                    className={riskSummary.piiCount > 0 ? "border-orange-500 text-orange-600 dark:text-orange-400" : ""}
                    data-testid="chip-pii"
                  >
                    PII {riskSummary.piiCount}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={riskSummary.riskCount > 0 ? "border-red-500 text-red-600 dark:text-red-400" : ""}
                    data-testid="chip-risk"
                  >
                    RISK {riskSummary.riskCount}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={riskSummary.anomCount > 0 ? "border-purple-500 text-purple-600 dark:text-purple-400" : ""}
                    data-testid="chip-anom"
                  >
                    ANOM {riskSummary.anomCount}
                  </Badge>
                </>
              ) : (
                <span className="text-muted-foreground" data-testid="risk-summary-empty">{"\u2014"}</span>
              )}
            </div>
            <Button
              variant="outline"
              asChild
              data-testid="button-open-proof-pack"
            >
              <a
                href={`/api/public/receipts/${encodeURIComponent(receipt.receiptId)}/proof`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Proof Pack
              </a>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className={receipt.hindsightKillSwitch === 1 ? "border-destructive/50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Power className="h-4 w-4" />
                  Hindsight Kill Switch
                </CardTitle>
              </CardHeader>
              <CardContent>
                {receipt.hindsightKillSwitch === 1 ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Kill Switch Engaged</AlertTitle>
                    <AlertDescription>
                      Interpretation has been permanently disabled for this receipt. This action cannot be reversed.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      The kill switch permanently disables all interpretation capabilities for this receipt. 
                      Use this if you believe the receipt should not be further analyzed.
                    </p>
                    <Dialog open={killSwitchDialogOpen} onOpenChange={setKillSwitchDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" data-testid="button-engage-kill-switch">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Engage Kill Switch
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirm Kill Switch</DialogTitle>
                          <DialogDescription>
                            This action is permanent and cannot be undone. Once engaged, no further interpretations 
                            can be generated for this receipt.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setKillSwitchDialogOpen(false)}>Cancel</Button>
                          <Button 
                            variant="destructive" 
                            onClick={() => killSwitchMutation.mutate()}
                            disabled={killSwitchMutation.isPending}
                            data-testid="button-confirm-kill-switch"
                          >
                            {killSwitchMutation.isPending ? "Engaging..." : "Confirm Kill Switch"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Tri-Sensor Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Run parallel analysis with interpreter, summarizer, and claim extractor sensors.
                </p>
                <Button 
                  onClick={() => triSensorMutation.mutate()}
                  disabled={!canInterpret || triSensorMutation.isPending}
                  data-testid="button-tri-sensor"
                >
                  {triSensorMutation.isPending ? "Analyzing..." : "Run Tri-Sensor"}
                </Button>
                {!canInterpret && (
                  <p className="text-xs text-destructive mt-2">
                    {receipt.verificationStatus === "UNVERIFIED" ? "Cannot analyze unverified receipts" : "Kill switch engaged"}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Download a complete forensic report including verification, forensics, and interpretations.
                </p>
                {data?.transcriptMode && data.transcriptMode !== "full" && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 bg-muted p-2 rounded">
                    <EyeOff className="h-3 w-3" />
                    <span>Transcript mode: <strong>{data.transcriptMode}</strong></span>
                  </div>
                )}
                <Button 
                  variant="outline"
                  onClick={() => {
                    window.open(`/api/receipts/${receiptId}/export`, '_blank');
                  }}
                  data-testid="button-export-report"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Interpretations
              </CardTitle>
              <CardDescription>
                Forensic analysis categorized by FACT, INTERPRETATION, and UNCERTAINTY
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canInterpret && (
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex gap-2">
                    <Select value={interpretKind} onValueChange={(v) => setInterpretKind(v as typeof interpretKind)}>
                      <SelectTrigger className="w-40" data-testid="select-interpret-kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fact">Fact</SelectItem>
                        <SelectItem value="interpretation">Interpretation</SelectItem>
                        <SelectItem value="uncertainty">Uncertainty</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      placeholder="Enter your forensic question..."
                      value={interpretQuestion}
                      onChange={(e) => setInterpretQuestion(e.target.value)}
                      className="min-h-[60px] flex-1"
                      data-testid="input-interpret-question"
                    />
                  </div>
                  <Button 
                    onClick={() => interpretMutation.mutate()}
                    disabled={!interpretQuestion.trim() || interpretMutation.isPending}
                    data-testid="button-submit-interpret"
                  >
                    {interpretMutation.isPending ? "Generating..." : "Generate Interpretation"}
                  </Button>
                </div>
              )}

              {!canInterpret && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Interpretation Disabled</AlertTitle>
                  <AlertDescription>
                    {receipt.verificationStatus === "UNVERIFIED" 
                      ? "This receipt failed verification. Interpretation is not available for unverified receipts."
                      : "The kill switch has been engaged. No further interpretations can be generated."}
                  </AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="facts" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="facts" className="flex items-center gap-1" data-testid="tab-facts">
                    <FileText className="h-3 w-3" />
                    Facts ({facts.length})
                  </TabsTrigger>
                  <TabsTrigger value="interpretations" className="flex items-center gap-1" data-testid="tab-interpretations">
                    <Lightbulb className="h-3 w-3" />
                    Interp ({interps.length})
                  </TabsTrigger>
                  <TabsTrigger value="uncertainties" className="flex items-center gap-1" data-testid="tab-uncertainties">
                    <HelpCircle className="h-3 w-3" />
                    Uncert ({uncertainties.length})
                  </TabsTrigger>
                  <TabsTrigger value="tri-sensor" className="flex items-center gap-1" data-testid="tab-tri-sensor">
                    <Layers className="h-3 w-3" />
                    Tri ({triSensors.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="facts" className="mt-4 space-y-4">
                  {receipt.verificationStatus === "UNVERIFIED" && (
                    <Alert variant="destructive" data-testid="alert-integrity-failed">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Integrity Failed</AlertTitle>
                      <AlertDescription>
                        Content may be tampered or incomplete. Treat all content as untrusted.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-accent" />
                      Verifiable Facts (Directly Observed)
                    </h3>
                    <Card className="bg-muted/30">
                      <CardContent className="py-4">
                        <div className="grid gap-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Hash Match</span>
                            <Badge variant={receipt.hashMatch === 1 ? "default" : "destructive"} className={receipt.hashMatch === 1 ? "bg-accent" : ""}>
                              {receipt.hashMatch === 1 ? "MATCH" : "MISMATCH"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Signature Status</span>
                            <Badge variant="outline">{receipt.signatureStatus}</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Verification Status</span>
                            {getStatusBadge(receipt.verificationStatus)}
                          </div>
                          <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Expected Hash</p>
                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded block break-all">{receipt.expectedHashSha256}</code>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Computed Hash</p>
                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded block break-all">{receipt.computedHashSha256}</code>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {forensics && (
                    <div className="space-y-4 pt-4 border-t">
                      <div>
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <BarChart2 className="h-4 w-4 text-primary" />
                          Forensic Signals (Heuristic / Deterministic)
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Heuristic signals. Not proof of content correctness.
                          {forensics.based_on === "submitted_payload" && (
                            <span className="text-destructive ml-1">Based on submitted payload (not verified).</span>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs font-mono">
                            Engine: {forensics.forensics_engine_id}
                          </Badge>
                          <Badge variant={forensics.integrity_context === "UNVERIFIED" ? "destructive" : "secondary"} className="text-xs">
                            Context: {forensics.integrity_context}
                          </Badge>
                        </div>
                      </div>

                      <Card className="bg-muted/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <BarChart2 className="h-4 w-4 text-primary" />
                            Transcript Statistics
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Messages</p>
                              <p className="font-mono font-medium" data-testid="stat-message-count">{forensics.transcript_stats.message_count}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Total Chars</p>
                              <p className="font-mono font-medium" data-testid="stat-chars-total">{forensics.transcript_stats.chars_total.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Avg Chars/Msg</p>
                              <p className="font-mono font-medium">{forensics.transcript_stats.avg_chars_per_message}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Max Msg ({forensics.transcript_stats.max_message_role})</p>
                              <p className="font-mono font-medium">{forensics.transcript_stats.max_message_chars}</p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                            {Object.entries(forensics.transcript_stats.roles).filter(([_, v]) => v > 0).map(([role, count]) => (
                              <Badge key={role} variant="outline" className="font-mono text-xs">
                                <User className="h-3 w-3 mr-1" />{role}: {count}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-muted/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            Timestamp Analysis
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={forensics.timestamp_checks.present ? "default" : "secondary"}>
                              {forensics.timestamp_checks.present ? "Timestamps Present" : "No Timestamps"}
                            </Badge>
                            {forensics.timestamp_checks.missing_count > 0 && (
                              <Badge variant="outline">Missing: {forensics.timestamp_checks.missing_count}</Badge>
                            )}
                            {forensics.timestamp_checks.non_iso_count > 0 && (
                              <Badge variant="destructive">Non-ISO: {forensics.timestamp_checks.non_iso_count}</Badge>
                            )}
                            {forensics.timestamp_checks.non_monotonic_count > 0 && (
                              <Badge variant="destructive" data-testid="badge-non-monotonic">
                                Non-Monotonic: {forensics.timestamp_checks.non_monotonic_count}
                              </Badge>
                            )}
                          </div>
                          {forensics.timestamp_checks.notes.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {forensics.timestamp_checks.notes.map((note, i) => (
                                <p key={i}>{note}</p>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="bg-muted/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Code className="h-4 w-4 text-primary" />
                            Content Signals
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {forensics.content_signals.code_fence_count > 0 && (
                              <Badge variant="outline" data-testid="badge-code-fences">
                                Code Fences: {forensics.content_signals.code_fence_count}
                              </Badge>
                            )}
                            {forensics.content_signals.url_count > 0 && (
                              <Badge variant="outline" data-testid="badge-urls">
                                URLs: {forensics.content_signals.url_count}
                              </Badge>
                            )}
                            <Badge variant="secondary">
                              Newlines: {forensics.content_signals.newline_count_total}
                            </Badge>
                            {forensics.content_signals.non_printable_char_count > 0 && (
                              <Badge variant="destructive">
                                Non-Printable: {forensics.content_signals.non_printable_char_count}
                              </Badge>
                            )}
                            {forensics.content_signals.high_entropy_block_count > 0 && (
                              <Badge variant="destructive" data-testid="badge-high-entropy">
                                High Entropy Blocks: {forensics.content_signals.high_entropy_block_count}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-muted/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertOctagon className="h-4 w-4 text-primary" />
                            Risk Keywords (Heuristic)
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Keyword pattern matches only. Not content classification.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {forensics.risk_keywords.instructional.present && (
                              <Badge variant="secondary" data-testid="badge-instructional">
                                Instructional: {forensics.risk_keywords.instructional.count}
                              </Badge>
                            )}
                            {forensics.risk_keywords.medical.present && (
                              <Badge variant="destructive" data-testid="badge-medical">
                                Medical: {forensics.risk_keywords.medical.count}
                              </Badge>
                            )}
                            {forensics.risk_keywords.legal.present && (
                              <Badge variant="destructive" data-testid="badge-legal">
                                Legal: {forensics.risk_keywords.legal.count}
                              </Badge>
                            )}
                            {forensics.risk_keywords.financial.present && (
                              <Badge variant="destructive" data-testid="badge-financial">
                                Financial: {forensics.risk_keywords.financial.count}
                              </Badge>
                            )}
                            {forensics.risk_keywords.self_harm.present && (
                              <Badge variant="destructive" className="animate-pulse" data-testid="badge-self-harm">
                                Self-Harm: {forensics.risk_keywords.self_harm.count}
                              </Badge>
                            )}
                            {!Object.values(forensics.risk_keywords).some(m => m.present) && (
                              <Badge variant="outline">No risk keywords detected</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-muted/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            PII Heuristics
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Potential identifier patterns (heuristic). Not confirmed PII.
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2">
                            {forensics.pii_heuristics.email_like_count > 0 && (
                              <Badge variant="outline" data-testid="badge-email">
                                Email-like: {forensics.pii_heuristics.email_like_count}
                              </Badge>
                            )}
                            {forensics.pii_heuristics.phone_like_count > 0 && (
                              <Badge variant="outline" data-testid="badge-phone">
                                Phone-like: {forensics.pii_heuristics.phone_like_count}
                              </Badge>
                            )}
                            {forensics.pii_heuristics.ssn_like_count > 0 && (
                              <Badge variant="destructive" data-testid="badge-ssn">
                                SSN-like: {forensics.pii_heuristics.ssn_like_count}
                              </Badge>
                            )}
                            {forensics.pii_heuristics.dob_like_count > 0 && (
                              <Badge variant="outline">DOB-like: {forensics.pii_heuristics.dob_like_count}</Badge>
                            )}
                            {forensics.pii_heuristics.mrn_like_count > 0 && (
                              <Badge variant="destructive">MRN-like: {forensics.pii_heuristics.mrn_like_count}</Badge>
                            )}
                            {forensics.pii_heuristics.ip_like_count > 0 && (
                              <Badge variant="outline">IP-like: {forensics.pii_heuristics.ip_like_count}</Badge>
                            )}
                            {Object.values(forensics.pii_heuristics).every(v => typeof v === 'number' ? v === 0 : true) && (
                              <Badge variant="outline">No PII patterns detected</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {forensics.anomalies.length > 0 && (
                        <Card className="border-destructive/50">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                              <AlertTriangle className="h-4 w-4" />
                              Anomalies Detected ({forensics.anomalies.length})
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {forensics.anomalies.map((anomaly, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                  <Badge 
                                    variant={anomaly.severity === "HIGH" ? "destructive" : anomaly.severity === "MEDIUM" ? "secondary" : "outline"}
                                    className="text-xs shrink-0"
                                  >
                                    {anomaly.severity}
                                  </Badge>
                                  <div>
                                    <code className="text-xs font-mono">{anomaly.code}</code>
                                    <p className="text-muted-foreground text-xs mt-0.5">{anomaly.message}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {facts.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium">User-Generated Facts</h4>
                          {facts.map((f) => (
                            <Card key={f.id} className="bg-muted/30">
                              <CardContent className="py-3">
                                <p className="text-sm whitespace-pre-wrap">{f.content}</p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  {f.modelId} · {new Date(f.createdAt).toLocaleString()}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!forensics && facts.length > 0 && (
                    <div className="space-y-3 mt-4">
                      <p className="text-sm text-muted-foreground">Legacy forensics not available for this receipt. User-generated facts below:</p>
                      {facts.map((f) => (
                        <Card key={f.id} className="bg-muted/30">
                          <CardContent className="py-3">
                            <p className="text-sm whitespace-pre-wrap">{f.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {f.modelId} · {new Date(f.createdAt).toLocaleString()}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="interpretations" className="mt-4">
                  {interps.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No interpretations recorded yet</p>
                  ) : (
                    <div className="space-y-3">
                      {interps.map((i) => (
                        <Card key={i.id} className="bg-muted/30">
                          <CardContent className="py-3">
                            <p className="text-sm whitespace-pre-wrap">{i.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {i.modelId} · {new Date(i.createdAt).toLocaleString()}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="uncertainties" className="mt-4">
                  {uncertainties.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No uncertainties recorded yet</p>
                  ) : (
                    <div className="space-y-3">
                      {uncertainties.map((u) => (
                        <Card key={u.id} className="bg-muted/30">
                          <CardContent className="py-3">
                            <p className="text-sm whitespace-pre-wrap">{u.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {u.modelId} · {new Date(u.createdAt).toLocaleString()}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tri-sensor" className="mt-4">
                  {triSensors.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No tri-sensor analyses yet</p>
                  ) : (
                    <div className="space-y-3">
                      {triSensors.map((t) => {
                        let parsed: TriSensorResult | null = null;
                        try {
                          parsed = JSON.parse(t.content) as TriSensorResult;
                        } catch {}
                        return (
                          <Card key={t.id} className="bg-muted/30">
                            <CardContent className="py-3 space-y-3">
                              {parsed ? (
                                <>
                                  {parsed.disagreement_detected && (
                                    <Badge variant="destructive">DISAGREEMENT DETECTED</Badge>
                                  )}
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Interpreter</p>
                                      <p className="text-sm">{parsed.interpreter.output}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Summarizer</p>
                                      <p className="text-sm">{parsed.summarizer.output}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Claim Extractor</p>
                                      <p className="text-sm">{parsed.claimExtractor.output}</p>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <pre className="text-xs whitespace-pre-wrap">{t.content}</pre>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {t.modelId} · {new Date(t.createdAt).toLocaleString()}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 p-4 border rounded-md">
              <FileText className="h-4 w-4" />
              View Raw Capsule JSON
            </summary>
            <pre className="mt-2 p-4 bg-card border rounded text-xs font-mono overflow-auto max-h-96" data-testid="text-raw-capsule">
              {JSON.stringify(rawCapsule, null, 2)}
            </pre>
          </details>
        </div>
      </main>
    </div>
  );
}

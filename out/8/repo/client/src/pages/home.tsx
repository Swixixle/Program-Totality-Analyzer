import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Shield, ShieldCheck, ShieldAlert, ShieldX, Copy, FileText, ArrowRight, Hash, Key, Link2 } from "lucide-react";
import type { VerifyResult } from "@shared/schema";

export default function Home() {
  const [capsuleJson, setCapsuleJson] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const { toast } = useToast();

  const verifyMutation = useMutation({
    mutationFn: async (json: string) => {
      const capsule = JSON.parse(json);
      const requestBody = {
        schema: "ai-receipt/verify-request/1.0" as const,
        request_id: crypto.randomUUID(),
        receipt_capsule: capsule,
        options: {
          verify_signature: true,
          verify_chain: false,
          key_registry_mode: "allow_untrusted" as const,
        },
      };
      const res = await apiRequest("POST", "/api/verify", requestBody);
      return res.json() as Promise<VerifyResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Verification Complete",
        description: `Status: ${data.verification_status}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleVerify = () => {
    if (!capsuleJson.trim()) {
      toast({
        title: "Empty Input",
        description: "Please paste a receipt capsule JSON",
        variant: "destructive",
      });
      return;
    }
    try {
      JSON.parse(capsuleJson);
      verifyMutation.mutate(capsuleJson);
    } catch {
      toast({
        title: "Invalid JSON",
        description: "The input is not valid JSON",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <ShieldCheck className="h-6 w-6 text-accent" />;
      case "PARTIALLY_VERIFIED":
        return <ShieldAlert className="h-6 w-6 text-yellow-500" />;
      case "UNVERIFIED":
        return <ShieldX className="h-6 w-6 text-destructive" />;
      default:
        return <Shield className="h-6 w-6" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-accent text-accent-foreground">VERIFIED</Badge>;
      case "PARTIALLY_VERIFIED":
        return <Badge className="bg-yellow-500 text-white">PARTIALLY VERIFIED</Badge>;
      case "UNVERIFIED":
        return <Badge variant="destructive">UNVERIFIED</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight">AI Receipts</h1>
                <p className="text-sm text-muted-foreground">Forensic Verification System</p>
              </div>
            </div>
            <nav className="flex items-center gap-2">
              <Link href="/receipts">
                <Button variant="ghost" data-testid="link-receipts">
                  <FileText className="h-4 w-4 mr-2" />
                  Receipts
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Verify Receipt Capsule
              </CardTitle>
              <CardDescription>
                Paste a receipt capsule JSON to verify its integrity and authenticity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder='{"schema": "ai-receipt/1.0", "receipt_id": "...", ...}'
                className="font-mono text-sm min-h-[200px] resize-y"
                value={capsuleJson}
                onChange={(e) => setCapsuleJson(e.target.value)}
                data-testid="input-capsule-json"
              />
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleVerify} 
                  disabled={verifyMutation.isPending}
                  data-testid="button-verify"
                >
                  {verifyMutation.isPending ? (
                    <>Verifying...</>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Verify & Save
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCapsuleJson("")}
                  data-testid="button-clear"
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card className="border-2" style={{ borderColor: result.verification_status === "VERIFIED" ? "hsl(165 70% 40%)" : result.verification_status === "UNVERIFIED" ? "hsl(0 72% 50%)" : "hsl(45 100% 50%)" }}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.verification_status)}
                    <div>
                      <CardTitle data-testid="text-verification-status">Verification Result</CardTitle>
                      <CardDescription className="font-mono text-xs mt-1">
                        Receipt ID: {result.receipt_id}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(result.verification_status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {result.failure_modes.length > 0 && (
                  <Alert variant="destructive">
                    <ShieldX className="h-4 w-4" />
                    <AlertTitle>Verification Failures</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {result.failure_modes.map((fm, i) => (
                          <li key={i} className="font-mono text-sm">
                            <span className="font-semibold">{fm.code}:</span> {fm.message}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Integrity Check
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Expected Hash</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-background px-2 py-1 rounded break-all flex-1" data-testid="text-expected-hash">
                            {result.integrity.expected_hash_sha256}
                          </code>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => copyToClipboard(result.integrity.expected_hash_sha256)}
                            data-testid="button-copy-expected-hash"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Computed Hash</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-background px-2 py-1 rounded break-all flex-1" data-testid="text-computed-hash">
                            {result.integrity.computed_hash_sha256}
                          </code>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => copyToClipboard(result.integrity.computed_hash_sha256)}
                            data-testid="button-copy-computed-hash"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={result.integrity.hash_match ? "default" : "destructive"} className={result.integrity.hash_match ? "bg-accent" : ""}>
                          {result.integrity.hash_match ? "MATCH" : "MISMATCH"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Canonicalization: {result.integrity.canonicalization}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Signature Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Algorithm</p>
                        <code className="text-xs font-mono bg-background px-2 py-1 rounded block">
                          {result.signature.alg || "N/A"}
                        </code>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge variant={result.signature.status === "VALID" ? "default" : result.signature.status === "UNTRUSTED_ISSUER" ? "secondary" : "destructive"} data-testid="text-signature-status">
                          {result.signature.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground" data-testid="text-signature-reason">
                        {result.signature.reason}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-muted/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Chain Verification
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{result.chain.status}</Badge>
                      <span className="text-xs text-muted-foreground">{result.chain.reason}</span>
                    </div>
                  </CardContent>
                </Card>

                <details className="group">
                  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
                    View Canonical Transcript
                  </summary>
                  <pre className="mt-3 p-4 bg-background border rounded text-xs font-mono overflow-auto max-h-64" data-testid="text-canonical-transcript">
                    {result.integrity.canonical_transcript}
                  </pre>
                </details>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Link href={`/receipts/${result.receipt_id}`}>
                    <Button variant="outline" data-testid="link-receipt-detail">
                      <FileText className="h-4 w-4 mr-2" />
                      View Receipt Details
                    </Button>
                  </Link>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Verified at: {result.verification_engine.verified_at}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

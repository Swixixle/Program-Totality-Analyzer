import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UploadDrawer } from "@/components/UploadDrawer";
import { 
  FolderOpen, Plus, FileText, Clock, Shield, Archive, 
  ChevronRight, Loader2, AlertTriangle, RefreshCw
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/auth";

interface Case {
  id: string;
  name: string;
  status: string;
  decisionTarget: string | null;
  decisionTime: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Upload {
  id: string;
  caseId: string;
  filename: string;
  mimeType: string;
  evidenceType: string;
  ingestionState: string;
  createdAt: string;
}

export default function Cases() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newCaseName, setNewCaseName] = useState("");
  const [newCaseTarget, setNewCaseTarget] = useState("");
  const [creating, setCreating] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    const result = await apiGet<Case[]>("/api/cases");
    if (result.ok) {
      setCases(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  const loadUploads = useCallback(async (caseId: string) => {
    setLoadingUploads(true);
    const result = await apiGet<Upload[]>(`/api/cases/${caseId}/uploads`);
    if (result.ok) {
      setUploads(result.data);
    } else {
      setUploads([]);
    }
    setLoadingUploads(false);
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (selectedCase) {
      loadUploads(selectedCase.id);
    } else {
      setUploads([]);
    }
  }, [selectedCase, loadUploads]);

  const createCase = async () => {
    if (!newCaseName.trim()) return;
    
    setCreating(true);
    const result = await apiPost<Case>("/api/cases", {
      name: newCaseName.trim(),
      decisionTarget: newCaseTarget.trim() || null
    });
    
    if (result.ok) {
      setCases(prev => [result.data, ...prev]);
      setSelectedCase(result.data);
      setNewCaseOpen(false);
      setNewCaseName("");
      setNewCaseTarget("");
    } else {
      setError(result.error);
    }
    setCreating(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/20 text-green-500";
      case "sealed": return "bg-amber-500/20 text-amber-500";
      case "archived": return "bg-gray-500/20 text-gray-500";
      default: return "bg-gray-500/20 text-gray-500";
    }
  };

  const getIngestionColor = (state: string) => {
    if (state === "ready") return "bg-green-500/20 text-green-500";
    if (state.startsWith("failed")) return "bg-red-500/20 text-red-500";
    return "bg-blue-500/20 text-blue-500";
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="text-page-title">
                <FolderOpen className="w-8 h-8 text-cyan-500" />
                Cases
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage investigative cases and attached evidence
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadCases}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={newCaseOpen} onOpenChange={setNewCaseOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-case">
                    <Plus className="w-4 h-4 mr-2" />
                    New Case
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Case</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="case-name">Case Name *</Label>
                      <Input
                        id="case-name"
                        value={newCaseName}
                        onChange={(e) => setNewCaseName(e.target.value)}
                        placeholder="e.g., Acme Corp Investigation"
                        data-testid="input-case-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="decision-target">Decision Target (optional)</Label>
                      <Input
                        id="decision-target"
                        value={newCaseTarget}
                        onChange={(e) => setNewCaseTarget(e.target.value)}
                        placeholder="e.g., Determine if regulatory violation occurred"
                        data-testid="input-decision-target"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewCaseOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createCase} disabled={!newCaseName.trim() || creating} data-testid="button-create-case">
                      {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Create Case
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              All Cases ({cases.length})
            </h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : cases.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No cases yet. Create one to start.
                </CardContent>
              </Card>
            ) : (
              cases.map((c) => (
                <Card
                  key={c.id}
                  className={`cursor-pointer transition-colors ${
                    selectedCase?.id === c.id ? "border-cyan-500 bg-cyan-500/5" : "hover:border-muted-foreground/30"
                  }`}
                  onClick={() => setSelectedCase(c)}
                  data-testid={`card-case-${c.id}`}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3" />
                          {new Date(c.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(c.status)} variant="secondary">
                          {c.status}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="md:col-span-2">
            {selectedCase ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{selectedCase.name}</CardTitle>
                      <CardDescription className="font-mono text-xs mt-1">
                        {selectedCase.id}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <UploadDrawer
                        caseId={selectedCase.id}
                        caseName={selectedCase.name}
                        onUploadComplete={() => loadUploads(selectedCase.id)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <div className="mt-1">
                        <Badge className={getStatusColor(selectedCase.status)} variant="secondary">
                          {selectedCase.status === "sealed" && <Shield className="w-3 h-3 mr-1" />}
                          {selectedCase.status === "archived" && <Archive className="w-3 h-3 mr-1" />}
                          {selectedCase.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Created</Label>
                      <div className="mt-1 text-sm">
                        {new Date(selectedCase.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {selectedCase.decisionTarget && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Decision Target</Label>
                      <div className="mt-1 text-sm">{selectedCase.decisionTarget}</div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                        Attached Evidence ({uploads.length})
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadUploads(selectedCase.id)}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    </div>

                    {loadingUploads ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : uploads.length === 0 ? (
                      <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
                        No evidence attached yet. Use the Attach button to upload files.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {uploads.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between p-3 bg-muted rounded-lg"
                            data-testid={`upload-${u.id}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{u.filename}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">{u.evidenceType}</Badge>
                                  <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <Badge className={getIngestionColor(u.ingestionState)} variant="secondary">
                              {u.ingestionState}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed h-full flex items-center justify-center min-h-[400px]">
                <CardContent className="text-center text-muted-foreground">
                  <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a case to view details and manage evidence</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

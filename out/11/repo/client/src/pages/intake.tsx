import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Upload, AlertCircle, FileText, CheckCircle, Anchor, Loader2, Download, FolderOpen, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { CORPUS_PURPOSES, SYSTEM_LIMITATIONS, type CorpusPurpose, type CorpusSource } from "@/lib/schema/corpus";
import { useReadOnlyMode } from "@/lib/config";
import { apiPost, apiClient, apiGet } from "@/lib/auth";

interface RecentCorpus {
  corpus_id: string;
  purpose: string;
  created_at: string;
}

interface BuildResult {
  corpus_id: string;
  mode: string;
  status: string;
  anchors_created: number;
  claims_created: number;
  constraints_created: number;
}

export default function Intake() {
  const [, navigate] = useLocation();
  const { isReadOnly } = useReadOnlyMode();
  
  const [purpose, setPurpose] = useState<CorpusPurpose | "">("");
  const [corpusId, setCorpusId] = useState<string | null>(null);
  const [creatingCorpus, setCreatingCorpus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [primarySources, setPrimarySources] = useState<CorpusSource[]>([]);
  const [secondarySources, setSecondarySources] = useState<CorpusSource[]>([]);
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [uploadingSecondary, setUploadingSecondary] = useState(false);
  
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingRepro, setExportingRepro] = useState(false);
  const [includeRawSources, setIncludeRawSources] = useState(false);
  const [strictMode, setStrictMode] = useState(true);
  
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  const [recentCorpora, setRecentCorpora] = useState<RecentCorpus[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    const fetchRecentCorpora = async () => {
      const result = await apiGet<{ corpora: RecentCorpus[] }>("/api/corpora");
      if (result.ok) {
        setRecentCorpora(result.data.corpora);
      }
      setLoadingRecent(false);
    };
    fetchRecentCorpora();
  }, []);

  const handleCreateCorpus = async () => {
    if (!purpose) return;
    
    setCreatingCorpus(true);
    setError(null);
    
    const result = await apiPost<{ corpus_id: string }>("/api/corpus", { purpose });
    
    if (!result.ok) {
      setError(result.error);
    } else {
      setCorpusId(result.data.corpus_id);
    }
    setCreatingCorpus(false);
  };

  const handleUpload = async (file: File, role: "PRIMARY" | "SECONDARY") => {
    if (!corpusId) return;
    
    const setUploading = role === "PRIMARY" ? setUploadingPrimary : setUploadingSecondary;
    const setSources = role === "PRIMARY" ? setPrimarySources : setSecondarySources;
    
    setUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("role", role);
    
    const result = await apiClient<CorpusSource>(`/api/corpus/${corpusId}/sources`, {
      method: "POST",
      body: formData
    });
    
    if (!result.ok) {
      setError(result.error);
    } else {
      setSources(prev => [...prev, result.data]);
    }
    setUploading(false);
  };

  const handlePrimaryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, "PRIMARY");
    e.target.value = "";
  };

  const handleSecondaryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, "SECONDARY");
    e.target.value = "";
  };

  const handleBuildAnchors = async () => {
    if (!corpusId) return;
    
    setBuilding(true);
    setError(null);
    setBuildResult(null);
    
    const result = await apiPost<BuildResult>(`/api/corpus/${corpusId}/build`, { mode: "anchors_only" });
    
    if (!result.ok) {
      setError(result.error);
    } else {
      setBuildResult(result.data);
    }
    setBuilding(false);
  };

  const hasAnySources = primarySources.length > 0 || secondarySources.length > 0;

  const getAuthHeaders = (): Record<string, string> => {
    const apiKey = localStorage.getItem("lantern_api_key");
    return apiKey ? { "Authorization": `Bearer ${apiKey}` } : {};
  };

  const handleExportBundle = async () => {
    if (!corpusId) return;
    
    setExporting(true);
    setError(null);
    
    try {
      const url = `/api/corpus/${corpusId}/export_bundle${includeRawSources ? "?include_raw_sources=true" : ""}`;
      const response = await fetch(url, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        setError("Unauthorized");
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to export bundle");
      }
      
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `lantern-corpus-${corpusId}.zip`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExporting(false);
    }
  };

  const handleExportReproPack = async () => {
    if (!corpusId) return;
    
    setExportingRepro(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (includeRawSources) params.set("include_raw_sources", "true");
      if (!strictMode) params.set("strict", "false");
      const queryStr = params.toString();
      const url = `/api/corpus/${corpusId}/export_repro_pack${queryStr ? "?" + queryStr : ""}`;
      const response = await fetch(url, {
        headers: getAuthHeaders()
      });
      
      if (response.status === 401) {
        setError("Unauthorized");
        return;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to export repro pack");
      }
      
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `lantern-repro-pack-${corpusId}.zip`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExportingRepro(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">LANTERN</h1>
          </div>
          <p className="text-muted-foreground">Corpus Intake</p>
        </header>

        {error && (
          <Card className="mb-6 border-red-500/30">
            <CardContent className="py-3 text-sm text-red-400">
              {error}
            </CardContent>
          </Card>
        )}

        {recentCorpora.length > 0 && !corpusId && (
          <Card className="mb-6 border-cyan-500/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Recent Corpora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentCorpora.slice(0, 5).map((corpus) => (
                  <div
                    key={corpus.corpus_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    data-testid={`corpus-${corpus.corpus_id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{corpus.purpose}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {corpus.corpus_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(corpus.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Link href={`/?corpusId=${corpus.corpus_id}`}>
                        <Button variant="outline" size="sm" data-testid={`button-claims-${corpus.corpus_id}`}>
                          Claims
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                      <Link href={`/anchors/browse?corpusId=${corpus.corpus_id}`}>
                        <Button variant="outline" size="sm" data-testid={`button-anchors-${corpus.corpus_id}`}>
                          Anchors
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">System Limitations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {SYSTEM_LIMITATIONS.map((limitation, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  {limitation}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {!corpusId ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Create Corpus</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Purpose</label>
                <Select value={purpose} onValueChange={(v) => setPurpose(v as CorpusPurpose)}>
                  <SelectTrigger data-testid="select-purpose">
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {CORPUS_PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {!isReadOnly && (
                <Button
                  onClick={handleCreateCorpus}
                  disabled={!purpose || creatingCorpus}
                  className="bg-cyan-600 hover:bg-cyan-500"
                  data-testid="button-create-corpus"
                >
                  Create Corpus
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-6 border-cyan-500/30 bg-cyan-500/5">
              <CardContent className="py-4">
                <p className="text-sm font-semibold text-cyan-400 mb-2">Corpus Created</p>
                <p className="text-xs font-mono text-muted-foreground" data-testid="corpus-id">
                  corpus_id: {corpusId}
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Primary Sources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    ref={primaryInputRef}
                    type="file"
                    className="hidden"
                    onChange={handlePrimaryFileChange}
                    data-testid="input-primary-file"
                  />
                  {!isReadOnly && (
                    <Button
                      onClick={() => primaryInputRef.current?.click()}
                      disabled={uploadingPrimary}
                      variant="outline"
                      className="w-full"
                      data-testid="button-upload-primary"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingPrimary ? "Uploading..." : "Upload Primary"}
                    </Button>
                  )}
                  
                  {primarySources.length > 0 && (
                    <div className="space-y-2">
                      {primarySources.map((source) => (
                        <div key={source.source_id} className="p-2 bg-muted/30 rounded text-xs" data-testid={`source-${source.source_id}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-3 h-3" />
                            <span className="truncate">{source.filename}</span>
                          </div>
                          <div className="text-muted-foreground font-mono text-[10px] break-all">
                            sha256: {source.sha256_hex}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Secondary Sources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    ref={secondaryInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleSecondaryFileChange}
                    data-testid="input-secondary-file"
                  />
                  {!isReadOnly && (
                    <Button
                      onClick={() => secondaryInputRef.current?.click()}
                      disabled={uploadingSecondary}
                      variant="outline"
                      className="w-full"
                      data-testid="button-upload-secondary"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingSecondary ? "Uploading..." : "Upload Secondary"}
                    </Button>
                  )}
                  
                  {secondarySources.length > 0 && (
                    <div className="space-y-2">
                      {secondarySources.map((source) => (
                        <div key={source.source_id} className="p-2 bg-muted/30 rounded text-xs" data-testid={`source-${source.source_id}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-3 h-3" />
                            <span className="truncate">{source.filename}</span>
                          </div>
                          <div className="text-muted-foreground font-mono text-[10px] break-all">
                            sha256: {source.sha256_hex}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {hasAnySources && !isReadOnly && (
              <div className="space-y-4">
                <Button
                  onClick={handleBuildAnchors}
                  disabled={building}
                  variant="outline"
                  className="w-full"
                  data-testid="button-build-anchors"
                >
                  {building ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Anchor className="w-4 h-4 mr-2" />
                  )}
                  Build Anchors (Explicit)
                </Button>
                
                {buildResult && (
                  <Card className="border-cyan-500/30 bg-cyan-500/5">
                    <CardContent className="py-4">
                      <p className="text-sm font-semibold text-cyan-400 mb-2">Build Complete</p>
                      <div className="text-xs font-mono text-muted-foreground space-y-1">
                        <p>mode: {buildResult.mode}</p>
                        <p>status: {buildResult.status}</p>
                        <p>anchors_created: {buildResult.anchors_created}</p>
                        <p>claims_created: {buildResult.claims_created}</p>
                        <p>constraints_created: {buildResult.constraints_created}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <Button
                  onClick={() => navigate(`/?corpusId=${corpusId}`)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500"
                  data-testid="button-enter-claim-space"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Enter Claim Space
                </Button>
                
                <div className="border-t border-border pt-4 mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="include-raw-sources"
                      checked={includeRawSources}
                      onCheckedChange={(checked) => setIncludeRawSources(checked === true)}
                      data-testid="checkbox-include-raw-sources"
                    />
                    <label htmlFor="include-raw-sources" className="text-sm text-muted-foreground">
                      Include raw sources (PDFs)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="strict-mode"
                      checked={strictMode}
                      onCheckedChange={(checked) => setStrictMode(checked === true)}
                      data-testid="checkbox-strict-mode"
                    />
                    <label htmlFor="strict-mode" className="text-sm text-muted-foreground">
                      Strict mode
                    </label>
                  </div>
                  {!isReadOnly && (
                    <>
                      <Button
                        onClick={handleExportBundle}
                        disabled={exporting}
                        variant="outline"
                        className="w-full"
                        data-testid="button-export-bundle"
                      >
                        {exporting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Export Corpus Bundle (ZIP)
                      </Button>
                      <Button
                        onClick={handleExportReproPack}
                        disabled={exportingRepro}
                        variant="outline"
                        className="w-full"
                        data-testid="button-export-repro-pack"
                      >
                        {exportingRepro ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        Export Repro Pack (ZIP)
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <footer className="mt-12 pt-6 border-t border-border/50 text-center text-xs text-muted-foreground">
          <p>No claims are generated automatically on upload.</p>
        </footer>
      </div>
    </div>
  );
}

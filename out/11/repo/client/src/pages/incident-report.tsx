import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Lock, 
  Plus, 
  Trash2, 
  Download, 
  Shield,
  Clock,
  FileWarning,
  Hash
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface EvidenceInput {
  description: string;
  source_type: string;
  time_anchor: string;
  confidence: "high" | "medium" | "low";
}

interface TimelineInput {
  timestamp: string;
  event_label: string;
  what_happened: string;
  source_refs: string[];
  verification_status: "verified" | "partial" | "disputed";
}

interface ActionItemInput {
  description: string;
  owner_role: string;
  due_date?: string;
  verification_method?: string;
}

interface RefusalEntry {
  reason_code: string;
  attempted_content: string;
  allowed_rewrite: string | null;
  disposition: string;
}

interface GeneratedReport {
  case_id: string;
  status: string;
  decision_under_review: {
    decision_point: string;
    window_start: string;
    window_end: string;
    decision_maker_role: string;
    setting?: string;
  };
  finalization: {
    immutable_state: string;
    artifact_hash: string | null;
  };
  refusal_log: RefusalEntry[];
}

const STATUS_COLORS: Record<string, string> = {
  ADMISSIBLE: "bg-green-500",
  REJECTED: "bg-red-500",
  SCRAPBOOKED: "bg-yellow-500",
  PENDING_TIME: "bg-orange-500",
  QUARANTINED: "bg-purple-500",
  DISPUTED: "bg-blue-500"
};

export default function IncidentReportPage() {
  const { apiKey } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/incident-report/:reportId");
  
  const [activeTab, setActiveTab] = useState("create");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    organization: "",
    scope_variant: "SCOPE_V1" as "SCOPE_V1" | "SCOPE_V2" | "SCOPE_V3",
    decision_point: "",
    window_start: "",
    window_end: "",
    decision_maker_role: "",
    setting: "",
    narrative_input: ""
  });
  
  const [constraints, setConstraints] = useState({
    time_pressure: false,
    competing_demands: false,
    resource_limits: false,
    guideline_ambiguity: false,
    handoffs_fragmentation: false,
    irreversibility: false,
    signal_quality_limits: false
  });
  
  const [admittedEvidence, setAdmittedEvidence] = useState<EvidenceInput[]>([]);
  const [missingPending, setMissingPending] = useState<EvidenceInput[]>([]);
  const [excludedOutcome, setExcludedOutcome] = useState<EvidenceInput[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineInput[]>([]);
  const [actionItems, setActionItems] = useState<ActionItemInput[]>([]);
  const [improvementNotes, setImprovementNotes] = useState<string[]>([]);
  
  const [generatedReport, setGeneratedReport] = useState<GeneratedReport | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [refusals, setRefusals] = useState<any[]>([]);
  
  const [reports, setReports] = useState<any[]>([]);
  
  useEffect(() => {
    if (activeTab === "list") {
      fetchReports();
    }
  }, [activeTab]);
  
  useEffect(() => {
    if (match && params?.reportId) {
      fetchReport(params.reportId);
      setActiveTab("view");
    }
  }, [match, params?.reportId]);
  
  const fetchReports = async () => {
    try {
      const res = await fetch("/api/reports", {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
  };
  
  const fetchReport = async (id: string) => {
    try {
      const res = await fetch(`/api/report/${id}`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedReport(data.report);
        setMarkdown(data.markdown);
        setReportId(id);
      }
    } catch (err) {
      console.error("Failed to fetch report:", err);
    }
  };
  
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const payload = {
        ...formData,
        environment: "demo" as const,
        constraints,
        admitted_evidence: admittedEvidence,
        missing_pending: missingPending,
        excluded_outcome_info: excludedOutcome,
        timeline_events: timelineEvents,
        action_items: actionItems,
        improvement_notes: improvementNotes
      };
      
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (data.success) {
        setGeneratedReport(data.report);
        setReportId(data.report_id);
        setMarkdown(data.markdown);
        setRefusals(data.refusals || []);
        setSuccess(`Report generated successfully. Status: ${data.report.status}`);
        setActiveTab("view");
      } else {
        setError(data.errors?.join(", ") || "Failed to generate report");
        if (data.report) {
          setGeneratedReport(data.report);
          setRefusals(data.refusals || []);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };
  
  const handleFinalize = async () => {
    if (!reportId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/report/${reportId}/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        }
      });
      
      const data = await res.json();
      
      if (data.success) {
        setGeneratedReport(data.report);
        setSuccess(`Report finalized. Hash: ${data.artifact_hash.slice(0, 16)}...`);
      } else {
        setError(data.message || "Failed to finalize report");
      }
    } catch (err: any) {
      setError(err.message || "Failed to finalize report");
    } finally {
      setLoading(false);
    }
  };
  
  const addEvidenceItem = (type: "admitted" | "missing" | "excluded") => {
    const newItem: EvidenceInput = {
      description: "",
      source_type: "",
      time_anchor: "",
      confidence: "medium"
    };
    
    if (type === "admitted") {
      setAdmittedEvidence([...admittedEvidence, newItem]);
    } else if (type === "missing") {
      setMissingPending([...missingPending, newItem]);
    } else {
      setExcludedOutcome([...excludedOutcome, newItem]);
    }
  };
  
  const updateEvidenceItem = (
    type: "admitted" | "missing" | "excluded",
    index: number,
    field: keyof EvidenceInput,
    value: string
  ) => {
    const update = (items: EvidenceInput[]) => {
      const updated = [...items];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    };
    
    if (type === "admitted") {
      setAdmittedEvidence(update(admittedEvidence));
    } else if (type === "missing") {
      setMissingPending(update(missingPending));
    } else {
      setExcludedOutcome(update(excludedOutcome));
    }
  };
  
  const removeEvidenceItem = (type: "admitted" | "missing" | "excluded", index: number) => {
    if (type === "admitted") {
      setAdmittedEvidence(admittedEvidence.filter((_, i) => i !== index));
    } else if (type === "missing") {
      setMissingPending(missingPending.filter((_, i) => i !== index));
    } else {
      setExcludedOutcome(excludedOutcome.filter((_, i) => i !== index));
    }
  };
  
  const addTimelineEvent = () => {
    setTimelineEvents([...timelineEvents, {
      timestamp: "",
      event_label: "",
      what_happened: "",
      source_refs: [],
      verification_status: "partial"
    }]);
  };
  
  const updateTimelineEvent = (index: number, field: keyof TimelineInput, value: any) => {
    const updated = [...timelineEvents];
    updated[index] = { ...updated[index], [field]: value };
    setTimelineEvents(updated);
  };
  
  const removeTimelineEvent = (index: number) => {
    setTimelineEvents(timelineEvents.filter((_, i) => i !== index));
  };
  
  const addActionItem = () => {
    setActionItems([...actionItems, {
      description: "",
      owner_role: "",
      due_date: "",
      verification_method: ""
    }]);
  };
  
  const renderEvidenceSection = (
    title: string,
    type: "admitted" | "missing" | "excluded",
    items: EvidenceInput[]
  ) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-base font-medium">{title}</Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm"
          onClick={() => addEvidenceItem(type)}
          data-testid={`btn-add-${type}-evidence`}
        >
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>
      
      {items.map((item, index) => (
        <div key={index} className="p-3 border rounded-lg space-y-2 bg-muted/30">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeEvidenceItem(type, index)}
              data-testid={`btn-remove-${type}-${index}`}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
          <Input
            placeholder="Description"
            value={item.description}
            onChange={(e) => updateEvidenceItem(type, index, "description", e.target.value)}
            data-testid={`input-${type}-description-${index}`}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Source type (e.g., EHR note)"
              value={item.source_type}
              onChange={(e) => updateEvidenceItem(type, index, "source_type", e.target.value)}
              data-testid={`input-${type}-source-${index}`}
            />
            <Input
              placeholder="Time anchor"
              value={item.time_anchor}
              onChange={(e) => updateEvidenceItem(type, index, "time_anchor", e.target.value)}
              data-testid={`input-${type}-time-${index}`}
            />
          </div>
          {type === "admitted" && (
            <Select
              value={item.confidence}
              onValueChange={(v) => updateEvidenceItem(type, index, "confidence", v)}
            >
              <SelectTrigger data-testid={`select-${type}-confidence-${index}`}>
                <SelectValue placeholder="Confidence level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      ))}
    </div>
  );
  
  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Incident Report Generator</h1>
        <p className="text-muted-foreground">
          Generate decision-time anchored, non-punitive post-incident review records
        </p>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="mb-6 border-green-500 bg-green-50 dark:bg-green-900/20">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="create" data-testid="tab-create">Create Report</TabsTrigger>
          <TabsTrigger value="view" data-testid="tab-view">View Report</TabsTrigger>
          <TabsTrigger value="list" data-testid="tab-list">All Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="create">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Decision Under Review
                </CardTitle>
                <CardDescription>
                  Define the specific decision point being reviewed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Decision Point *</Label>
                    <Input
                      placeholder="e.g., Discharge from ED after imaging"
                      value={formData.decision_point}
                      onChange={(e) => setFormData({ ...formData, decision_point: e.target.value })}
                      data-testid="input-decision-point"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Decision Maker Role *</Label>
                    <Input
                      placeholder="e.g., ED Attending"
                      value={formData.decision_maker_role}
                      onChange={(e) => setFormData({ ...formData, decision_maker_role: e.target.value })}
                      data-testid="input-decision-maker"
                    />
                  </div>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Window Start *</Label>
                    <Input
                      placeholder="e.g., 2024-01-15T14:30:00"
                      value={formData.window_start}
                      onChange={(e) => setFormData({ ...formData, window_start: e.target.value })}
                      data-testid="input-window-start"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Window End *</Label>
                    <Input
                      placeholder="e.g., 2024-01-15T16:00:00"
                      value={formData.window_end}
                      onChange={(e) => setFormData({ ...formData, window_end: e.target.value })}
                      data-testid="input-window-end"
                    />
                  </div>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Organization</Label>
                    <Input
                      placeholder="Optional"
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      data-testid="input-organization"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Setting</Label>
                    <Input
                      placeholder="e.g., Emergency Department"
                      value={formData.setting}
                      onChange={(e) => setFormData({ ...formData, setting: e.target.value })}
                      data-testid="input-setting"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Scope & Limits Variant</Label>
                  <Select
                    value={formData.scope_variant}
                    onValueChange={(v) => setFormData({ ...formData, scope_variant: v as any })}
                  >
                    <SelectTrigger data-testid="select-scope-variant">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCOPE_V1">Standard (SCOPE_V1)</SelectItem>
                      <SelectItem value="SCOPE_V2">Alternative (SCOPE_V2)</SelectItem>
                      <SelectItem value="SCOPE_V3">Concise (SCOPE_V3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Constraints & Conditions
                </CardTitle>
                <CardDescription>
                  Document decision-time constraints (no narrative)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {Object.entries(constraints).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                      <Label className="capitalize">{key.replace(/_/g, " ")}</Label>
                      <Switch
                        checked={value}
                        onCheckedChange={(checked) => setConstraints({ ...constraints, [key]: checked })}
                        data-testid={`switch-${key}`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileWarning className="w-5 h-5" />
                  Evidence Snapshot
                </CardTitle>
                <CardDescription>
                  Document decision-time evidence (admitted, pending, and excluded)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderEvidenceSection("Admitted Evidence (Decision-Time)", "admitted", admittedEvidence)}
                {renderEvidenceSection("Pending / Missing at Decision Time", "missing", missingPending)}
                {renderEvidenceSection("Excluded Outcome Information", "excluded", excludedOutcome)}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Timeline Events
                </CardTitle>
                <CardDescription>
                  Document verified timeline events (no inferred ordering)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={addTimelineEvent}
                  data-testid="btn-add-timeline"
                >
                  <Plus className="w-4 h-4 mr-1" /> Add Event
                </Button>
                
                {timelineEvents.map((event, index) => (
                  <div key={index} className="p-3 border rounded-lg space-y-2 bg-muted/30">
                    <div className="flex justify-between">
                      <Badge variant="outline">Event {index + 1}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTimelineEvent(index)}
                        data-testid={`btn-remove-timeline-${index}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input
                        placeholder="Timestamp"
                        value={event.timestamp}
                        onChange={(e) => updateTimelineEvent(index, "timestamp", e.target.value)}
                        data-testid={`input-timeline-timestamp-${index}`}
                      />
                      <Input
                        placeholder="Event label"
                        value={event.event_label}
                        onChange={(e) => updateTimelineEvent(index, "event_label", e.target.value)}
                        data-testid={`input-timeline-label-${index}`}
                      />
                    </div>
                    <Input
                      placeholder="What happened (neutral, observable)"
                      value={event.what_happened}
                      onChange={(e) => updateTimelineEvent(index, "what_happened", e.target.value)}
                      data-testid={`input-timeline-what-${index}`}
                    />
                    <Select
                      value={event.verification_status}
                      onValueChange={(v) => updateTimelineEvent(index, "verification_status", v)}
                    >
                      <SelectTrigger data-testid={`select-timeline-status-${index}`}>
                        <SelectValue placeholder="Verification status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="disputed">Disputed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Narrative Input (Optional)</CardTitle>
                <CardDescription>
                  Free-text will be scanned for prohibited terms and may be quarantined
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter any narrative context (will be scanned for evaluative language)"
                  value={formData.narrative_input}
                  onChange={(e) => setFormData({ ...formData, narrative_input: e.target.value })}
                  rows={4}
                  data-testid="textarea-narrative"
                />
              </CardContent>
            </Card>
            
            <div className="flex gap-4 justify-end">
              <Button
                onClick={handleGenerate}
                disabled={loading || !formData.decision_point || !formData.decision_maker_role}
                size="lg"
                data-testid="btn-generate-report"
              >
                {loading ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="view">
          {generatedReport ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Report: {generatedReport.case_id}
                        <Badge className={STATUS_COLORS[generatedReport.status] || "bg-gray-500"}>
                          {generatedReport.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Decision: {generatedReport.decision_under_review.decision_point}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {generatedReport.finalization.immutable_state === "finalized" ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Finalized
                        </Badge>
                      ) : (
                        <Button
                          onClick={handleFinalize}
                          disabled={loading}
                          variant="outline"
                          data-testid="btn-finalize"
                        >
                          <Lock className="w-4 h-4 mr-1" /> Finalize
                        </Button>
                      )}
                      {markdown && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            const blob = new Blob([markdown], { type: "text/markdown" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `report-${generatedReport.case_id}.md`;
                            a.click();
                          }}
                          data-testid="btn-download-md"
                        >
                          <Download className="w-4 h-4 mr-1" /> Download MD
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {generatedReport.finalization.artifact_hash && (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg mb-4">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <code className="text-sm font-mono">
                        {generatedReport.finalization.artifact_hash}
                      </code>
                    </div>
                  )}
                  
                  {markdown && (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-auto max-h-[600px]">
                        {markdown}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {refusals.length > 0 && (
                <Card className="border-amber-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="w-5 h-5" />
                      Refusals & Quarantines
                    </CardTitle>
                    <CardDescription>
                      Items that were refused, rewritten, or quarantined during generation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {refusals.map((refusal, index) => (
                        <div key={index} className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-900/20">
                          <div className="flex items-start gap-2 mb-2">
                            <Badge variant="outline" className="font-mono">
                              {refusal.reason_code}
                            </Badge>
                            <Badge 
                              variant={refusal.status === "refused" ? "destructive" : "secondary"}
                            >
                              {refusal.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{refusal.what_happened}</p>
                          <p className="text-sm text-muted-foreground mt-1">{refusal.why_it_matters}</p>
                          <p className="text-sm text-blue-600 mt-1">{refusal.how_to_proceed}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No report generated yet. Create a new report to view it here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>All Incident Reports</CardTitle>
              <CardDescription>
                View and manage all generated incident reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No reports generated yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {reports.map((report) => (
                    <div 
                      key={report.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/incident-report/${report.id}`)}
                      data-testid={`report-item-${report.id}`}
                    >
                      <div>
                        <p className="font-medium">{report.case_id}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(report.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_COLORS[report.status] || "bg-gray-500"}>
                          {report.status}
                        </Badge>
                        {report.immutable_state === "finalized" && (
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

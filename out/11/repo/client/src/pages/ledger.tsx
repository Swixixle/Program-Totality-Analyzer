import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Shield, Loader2, CheckCircle, XCircle } from "lucide-react";
import { apiGet } from "@/lib/auth";

interface LedgerEvent {
  event_id: string;
  occurred_at: string;
  corpus_id: string;
  event_type: string;
  entity: {
    entity_type: string;
    entity_id: string;
  };
  payload: Record<string, any>;
  hash_alg: string;
  hash_hex: string;
}

interface VerifyResponse {
  event_id: string;
  verified: boolean;
  hash_alg: string;
  stored_hash_hex: string;
  recomputed_hash_hex: string;
}

const EVENT_TYPES = [
  "ALL",
  "CORPUS_CREATED",
  "SOURCE_UPLOADED",
  "BUILD_RUN",
  "CLAIM_CREATED",
  "CLAIM_DELETED",
  "SNAPSHOT_CREATED",
  "PACKET_CREATED"
];

const LIMIT_OPTIONS = [100, 200, 500];

export default function Ledger() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const corpusId = params.get("corpusId") || "corpus-demo-001";

  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState("ALL");
  const [limit, setLimit] = useState(100);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResponse>>({});

  useEffect(() => {
    if (!corpusId) {
      setLoading(false);
      setError("No corpus ID provided");
      return;
    }
    fetchEvents();
  }, [corpusId, eventTypeFilter, limit]);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    
    let url = `/api/corpus/${corpusId}/ledger?limit=${limit}`;
    if (eventTypeFilter !== "ALL") {
      url += `&event_type=${eventTypeFilter}`;
    }
    
    const result = await apiGet<{ events: LedgerEvent[] }>(url);
    if (!result.ok) {
      setError(result.error);
    } else {
      setEvents(result.data.events);
    }
    setLoading(false);
  };

  const handleVerify = async (eventId: string) => {
    setVerifyingId(eventId);
    
    const result = await apiGet<VerifyResponse>(`/api/ledger/${eventId}/verify`);
    if (!result.ok) {
      setError(result.error);
    } else {
      setVerifyResults(prev => ({ ...prev, [eventId]: result.data }));
    }
    setVerifyingId(null);
  };

  if (!corpusId) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              No corpus ID provided. Navigate from Claim Space.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/?corpusId=${corpusId}`)}
              className="mb-2"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Claim Space
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Revision Ledger</h1>
            <p className="text-xs font-mono text-muted-foreground mt-1" data-testid="text-corpus-id">
              corpus_id: {corpusId}
            </p>
          </div>
        </header>

        <Card data-testid="filter-controls">
          <CardHeader>
            <CardTitle className="text-sm">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Event Type:</span>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Limit:</span>
              <Select value={String(limit)} onValueChange={(v) => setLimit(parseInt(v, 10))}>
                <SelectTrigger className="w-[100px]" data-testid="select-limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIMIT_OPTIONS.map(l => (
                    <SelectItem key={l} value={String(l)}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="py-4 text-red-400">
              {error}
            </CardContent>
          </Card>
        )}

        {!loading && !error && events.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              No events found.
            </CardContent>
          </Card>
        )}

        {!loading && events.length > 0 && (
          <div className="space-y-3">
            {events.map(event => (
              <Card key={event.event_id} data-testid={`event-${event.event_id}`}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded font-semibold">
                          {event.event_type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.occurred_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">entity_type: </span>
                        <span className="font-mono">{event.entity.entity_type}</span>
                        <span className="text-muted-foreground ml-3">entity_id: </span>
                        <span className="font-mono">{event.entity.entity_id}</span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        hash_hex: {event.hash_hex}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerify(event.event_id)}
                      disabled={verifyingId === event.event_id}
                      data-testid={`button-verify-${event.event_id}`}
                    >
                      {verifyingId === event.event_id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Shield className="w-4 h-4 mr-2" />
                      )}
                      Verify
                    </Button>
                  </div>
                  
                  {verifyResults[event.event_id] && (
                    <div className={`mt-2 p-2 rounded text-xs ${verifyResults[event.event_id].verified ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-red-500/10 border border-red-500/30"}`} data-testid={`verify-result-${event.event_id}`}>
                      <div className="flex items-center gap-2">
                        {verifyResults[event.event_id].verified ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className={verifyResults[event.event_id].verified ? "text-emerald-400" : "text-red-400"}>
                          {verifyResults[event.event_id].verified ? "Verified" : "Verification Failed"}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-muted-foreground">
                        stored: {verifyResults[event.event_id].stored_hash_hex}
                      </div>
                      <div className="font-mono text-muted-foreground">
                        recomputed: {verifyResults[event.event_id].recomputed_hash_hex}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

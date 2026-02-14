import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Eye, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useRoute } from "wouter";
import { HaloHeader } from "@/components/halo-header";
import { AuthRequiredBanner, isAuthError } from "@/components/auth-required-banner";

const OBSERVATION_TYPES = [
  "paraphrase",
  "ambiguity",
  "disagreement",
  "tone",
  "structure",
  "hedging",
  "refusal_pattern",
];

const MODELS = [
  { id: "mock-sensor", label: "Mock Sensor (Test)" },
  { id: "openai:gpt-4", label: "OpenAI GPT-4" },
  { id: "anthropic:claude-3", label: "Anthropic Claude 3" },
];

interface Observation {
  id: number;
  observation_type: string;
  model_id: string;
  content: string;
  hedging_applied: boolean;
  confidence_statement: string;
  limitations: string[];
  created_at: string;
}

interface Receipt {
  kill_switch_engaged: boolean;
  verification_status: string;
}

export default function Sensors() {
  const [, params] = useRoute("/receipts/:receiptId/sensors");
  const receiptId = params?.receiptId || "";
  
  const [observationType, setObservationType] = useState("");
  const [modelId, setModelId] = useState("");
  const [languageError, setLanguageError] = useState<{ tokens: string[] } | null>(null);

  const { data: receipt, error: receiptError } = useQuery<Receipt>({
    queryKey: ["/api/receipts", receiptId],
    enabled: !!receiptId,
  });

  const { data: observations, refetch } = useQuery<Observation[]>({
    queryKey: ["/api/receipts", receiptId, "observations"],
    enabled: !!receiptId,
  });

  const runSensorMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/receipts/${receiptId}/observe`, {
        observation_type: observationType,
        model_id: modelId,
      });
      return res.json();
    },
    onSuccess: () => {
      setLanguageError(null);
      refetch();
    },
    onError: (err: any) => {
      if (err.code === "LANGUAGE_VIOLATION") {
        setLanguageError({ tokens: err.blocked_tokens || [] });
      }
    },
  });

  if (receiptError && isAuthError(receiptError)) {
    return <AuthRequiredBanner title="Sensors" />;
  }

  const killSwitchEngaged = receipt?.kill_switch_engaged;

  if (killSwitchEngaged) {
    return (
      <div>
        <HaloHeader
          killSwitchEngaged={true}
          verificationStatus={receipt?.verification_status as "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | null}
          transcriptMode="full"
        />
        <div className="container mx-auto p-6 max-w-4xl">
          <h1 className="text-2xl font-bold mb-6" data-testid="text-sensors-title">Sensors</h1>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-muted-foreground" data-testid="text-kill-switch-block">
                <Lock className="w-5 h-5" />
                <p>Kill switch engaged. Interpretations and sensor outputs are blocked.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <HaloHeader
        killSwitchEngaged={false}
        verificationStatus={receipt?.verification_status as "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | null}
        transcriptMode="full"
      />
      <div className="container mx-auto p-6 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6" data-testid="text-sensors-title">Sensors</h1>

        {!receiptId ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Select a receipt from the Receipts page to run sensor observations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Observation Request
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Observation Type</Label>
                <Select value={observationType} onValueChange={setObservationType}>
                  <SelectTrigger data-testid="select-observation-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {OBSERVATION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Model</Label>
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger data-testid="select-model">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => runSensorMutation.mutate()}
                disabled={!observationType || !modelId || runSensorMutation.isPending}
                data-testid="button-run-sensor"
              >
                {runSensorMutation.isPending ? "Running..." : "Run sensor"}
              </Button>
            </CardContent>
          </Card>

          {languageError && (
            <Alert variant="destructive" className="mb-6" data-testid="alert-language-violation">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                <p className="font-semibold">LANGUAGE_VIOLATION</p>
                <p className="mt-1">Blocked tokens: {languageError.tokens.join(", ")}</p>
                <p className="mt-2 text-sm">
                  Template: Use hedging language (may, might, appears, could, seems, possibly, potentially, suggests, indicates)
                </p>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Observations</h2>
            
            {observations && observations.length > 1 && (
              <Alert className="mb-4" data-testid="alert-disagreement">
                <AlertDescription>
                  Disagreement is displayed without resolution by design.
                </AlertDescription>
              </Alert>
            )}

            {observations?.map((obs) => (
              <Card key={obs.id} data-testid={`card-observation-${obs.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{obs.observation_type}</Badge>
                    <Badge variant="secondary">{obs.model_id}</Badge>
                    {obs.hedging_applied && <Badge className="bg-blue-600">Hedged</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">{obs.content}</p>
                  
                  <div className="text-xs text-muted-foreground border-t pt-3">
                    <p className="italic">{obs.confidence_statement}</p>
                  </div>

                  {obs.limitations && obs.limitations.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium">Limitations:</p>
                      <ul className="list-disc list-inside">
                        {obs.limitations.map((lim, i) => (
                          <li key={i}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground italic mt-2">
                    This output is isolated. The model received only transcript text.
                  </p>
                </CardContent>
              </Card>
            ))}

            {(!observations || observations.length === 0) && (
              <Card>
                <CardContent className="pt-6 text-muted-foreground">
                  No observations yet. Run a sensor to generate observations.
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

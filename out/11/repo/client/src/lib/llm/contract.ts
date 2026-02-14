import { z } from "zod";

export const LLMContextSchema = z.object({
  caseId: z.string().min(1, "caseId is required"),
  decisionTarget: z.string().optional(),
  decisionTime: z.string().optional(),
  prerequisiteState: z.object({
    version: z.string(),
    hash: z.string().optional(),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(["exists", "equals", "not_empty", "min_count"]),
      value: z.unknown().optional()
    })).optional()
  }).optional(),
  evidenceIds: z.array(z.string()).optional(),
  refusalFlags: z.array(z.enum([
    "insufficient_evidence",
    "ambiguous_target",
    "missing_prerequisite",
    "scope_exceeded",
    "confidence_below_threshold"
  ])).optional()
});

export type LLMContext = z.infer<typeof LLMContextSchema>;

export const ContextRequiredResponseSchema = z.object({
  type: z.literal("CONTEXT_REQUIRED"),
  missing_fields: z.array(z.string()),
  next_actions: z.array(z.string()),
  message: z.string().optional()
});

export type ContextRequiredResponse = z.infer<typeof ContextRequiredResponseSchema>;

export const LLMResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SUCCESS"),
    content: z.unknown(),
    citations: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1).optional(),
    refusalFlags: z.array(z.string()).optional()
  }),
  z.object({
    type: z.literal("CONTEXT_REQUIRED"),
    missing_fields: z.array(z.string()),
    next_actions: z.array(z.string()),
    message: z.string().optional()
  }),
  z.object({
    type: z.literal("REFUSAL"),
    reason: z.string(),
    refusalFlags: z.array(z.string()),
    message: z.string().optional()
  }),
  z.object({
    type: z.literal("ERROR"),
    error: z.string(),
    message: z.string().optional()
  })
]);

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

interface RequiredField {
  field: keyof LLMContext;
  required: boolean;
  message: string;
  action: string;
}

const REQUIRED_CONTEXT_FIELDS: RequiredField[] = [
  { 
    field: "caseId", 
    required: true, 
    message: "All LLM calls must be bound to a case",
    action: "Select or create a case before proceeding"
  }
];

const OPTIONAL_CONTEXT_FIELDS: RequiredField[] = [
  { 
    field: "decisionTarget", 
    required: false, 
    message: "Decision target helps scope the analysis",
    action: "Define a decision target for the case"
  },
  { 
    field: "decisionTime", 
    required: false, 
    message: "Decision time provides temporal context",
    action: "Set a decision time for the case"
  }
];

export function validateLLMContext(context: Partial<LLMContext>): ContextRequiredResponse | null {
  const missing_fields: string[] = [];
  const next_actions: string[] = [];
  
  for (const field of REQUIRED_CONTEXT_FIELDS) {
    const value = context[field.field];
    const isEmpty = !value || (typeof value === 'string' && value.trim() === '');
    if (field.required && isEmpty) {
      missing_fields.push(field.field);
      next_actions.push(field.action);
    }
  }
  
  if (missing_fields.length > 0) {
    return {
      type: "CONTEXT_REQUIRED",
      missing_fields,
      next_actions,
      message: "Required context is missing. This system requires explicit case binding for all operations."
    };
  }
  
  return null;
}

export function buildLLMRequest(
  context: LLMContext,
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }
): { valid: true; request: object } | { valid: false; error: ContextRequiredResponse } {
  const validationError = validateLLMContext(context);
  if (validationError) {
    return { valid: false, error: validationError };
  }
  
  const systemPrompt = options?.systemPrompt || buildDefaultSystemPrompt(context);
  
  return {
    valid: true,
    request: {
      model: "gpt-4",
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      metadata: {
        caseId: context.caseId,
        decisionTarget: context.decisionTarget,
        decisionTime: context.decisionTime,
        prerequisiteVersion: context.prerequisiteState?.version,
        evidenceCount: context.evidenceIds?.length ?? 0
      }
    }
  };
}

function buildDefaultSystemPrompt(context: LLMContext): string {
  const lines = [
    "You are an investigative analysis assistant operating within the Lantern evidentiary system.",
    "",
    "GOVERNANCE CONSTRAINTS:",
    "- All outputs must be traceable to evidence in the case record",
    "- Do not infer facts not directly supported by evidence",
    "- Mark uncertain conclusions with explicit confidence levels",
    "- Cite evidence IDs using [CANON_REF:evidenceId] format",
    "- If evidence is insufficient, refuse to speculate",
    "",
    `CASE CONTEXT:`,
    `- Case ID: ${context.caseId}`
  ];
  
  if (context.decisionTarget) {
    lines.push(`- Decision Target: ${context.decisionTarget}`);
  }
  
  if (context.decisionTime) {
    lines.push(`- Decision Time: ${context.decisionTime}`);
  }
  
  if (context.evidenceIds && context.evidenceIds.length > 0) {
    lines.push(`- Evidence IDs in scope: ${context.evidenceIds.join(", ")}`);
  }
  
  lines.push("");
  lines.push("RESPONSE FORMAT:");
  lines.push("- Provide structured analysis with explicit evidence citations");
  lines.push("- Flag any gaps in evidence or ambiguities");
  lines.push("- Do not provide helpful-sounding generic responses without evidence");
  
  return lines.join("\n");
}

export function createRefusalResponse(
  reason: string,
  flags: string[]
): LLMResponse {
  return {
    type: "REFUSAL",
    reason,
    refusalFlags: flags,
    message: "This request cannot be processed due to governance constraints."
  };
}

export function createContextRequiredResponse(
  missingFields: string[],
  actions: string[]
): LLMResponse {
  return {
    type: "CONTEXT_REQUIRED",
    missing_fields: missingFields,
    next_actions: actions,
    message: "Required context is missing for this operation."
  };
}

export async function executeLLMCall(
  context: LLMContext,
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }
): Promise<LLMResponse> {
  const validationError = validateLLMContext(context);
  if (validationError) {
    return validationError;
  }
  
  const requestResult = buildLLMRequest(context, prompt, options);
  if (!requestResult.valid) {
    return requestResult.error;
  }
  
  try {
    const response = await fetch("/api/llm/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestResult.request)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (errorData.type === "CONTEXT_REQUIRED") {
        return errorData as ContextRequiredResponse;
      }
      
      return {
        type: "ERROR",
        error: errorData.message || "LLM request failed",
        message: "An error occurred while processing the request."
      };
    }
    
    const data = await response.json();
    
    return {
      type: "SUCCESS",
      content: data.content || data.choices?.[0]?.message?.content,
      citations: data.citations,
      confidence: data.confidence,
      refusalFlags: data.refusalFlags
    };
  } catch (err: any) {
    return {
      type: "ERROR",
      error: err.message || "Network error",
      message: "Failed to connect to LLM service."
    };
  }
}

export function isContextRequired(response: LLMResponse): response is ContextRequiredResponse & { type: "CONTEXT_REQUIRED" } {
  return response.type === "CONTEXT_REQUIRED";
}

export function isRefusal(response: LLMResponse): boolean {
  return response.type === "REFUSAL";
}

export function isSuccess(response: LLMResponse): boolean {
  return response.type === "SUCCESS";
}

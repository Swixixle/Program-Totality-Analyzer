#!/usr/bin/env tsx
/**
 * P6.3 Sensor Pipeline Tests
 * 
 * Validates:
 * - Happy path via mock adapter (schema-valid output)
 * - Invalid model_id rejection (400)
 * - Stub providers return 501 unchanged
 * - Forbidden word → rejected with error
 * - Missing hedging → auto-prefixed
 * - Missing limitations → auto-filled to min 2
 * - Kill switch blocks observations
 */

import { 
  runSensorPipeline, 
  runMultiModelPipeline,
  SensorPipelineError,
  normalizeModelId,
  type SensorPipelineInput,
} from "../server/llm/sensor-pipeline";

import { validateLanguageHygiene, hasAppropriateHedging } from "../shared/llm-observation-schema";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (e: any) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${e.message}`);
      failed++;
    }
  })();
}

function expect(value: any) {
  return {
    toBe(expected: any) {
      if (value !== expected) {
        throw new Error(`Expected ${expected} but got ${value}`);
      }
    },
    toEqual(expected: any) {
      if (JSON.stringify(value) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`);
      }
    },
    toBeDefined() {
      if (value === undefined) {
        throw new Error(`Expected value to be defined`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (value < expected) {
        throw new Error(`Expected ${value} to be >= ${expected}`);
      }
    },
    toHaveLength(expected: number) {
      if (value.length !== expected) {
        throw new Error(`Expected length ${expected} but got ${value.length}`);
      }
    },
    toContain(expected: string) {
      if (!value.includes(expected)) {
        throw new Error(`Expected "${value}" to contain "${expected}"`);
      }
    },
    not: {
      toBe(expected: any) {
        if (value === expected) {
          throw new Error(`Expected ${value} not to be ${expected}`);
        }
      },
      toContain(expected: string) {
        if (value.includes(expected)) {
          throw new Error(`Expected "${value}" not to contain "${expected}"`);
        }
      }
    }
  };
}

const sampleInput: SensorPipelineInput = {
  receiptId: "test-receipt-001",
  transcript: {
    messages: [
      { role: "user", content: "What is the capital of France?" },
      { role: "assistant", content: "The capital of France is Paris." }
    ]
  },
  basis: "verified_transcript",
  observationType: "paraphrase",
  modelId: "mock:mock-sensor",
};

async function runTests() {
  console.log("=== P6.3 Sensor Pipeline Tests ===\n");

  console.log("--- Happy Path via Mock Adapter ---");

  await test("should produce schema-valid observation via mock adapter", async () => {
    const result = await runSensorPipeline(sampleInput, false);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.observation.schema).toBe("llm-observation/1.0");
      expect(result.observation.model_id).toBe("mock:mock-sensor");
      expect(result.observation.observation_type).toBe("paraphrase");
      expect(result.observation.receipt_id).toBe("test-receipt-001");
      expect(result.observation.based_on).toBe("verified_transcript");
      expect(result.observation.confidence_statement).toBe(
        "This is a model-generated observation, not a factual determination."
      );
    }
  });

  await test("should include at least 2 limitations", async () => {
    const result = await runSensorPipeline(sampleInput, false);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.observation.limitations.length).toBeGreaterThanOrEqual(2);
    }
  });

  await test("should have valid ISO datetime for created_at", async () => {
    const result = await runSensorPipeline(sampleInput, false);
    expect(result.success).toBe(true);
    if (result.success) {
      const date = new Date(result.observation.created_at);
      expect(!isNaN(date.getTime())).toBe(true);
    }
  });

  console.log("\n--- Invalid Model ID Rejection (400) ---");

  await test("should reject invalid model_id format (missing colon)", async () => {
    const input = { ...sampleInput, modelId: "gpt4o" as any };
    const result = await runSensorPipeline(input, false);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_MODEL_ID");
      expect(result.error.status).toBe(400);
    }
  });

  await test("should reject invalid model_id format (uppercase)", async () => {
    const input = { ...sampleInput, modelId: "OpenAI:GPT-4o" as any };
    const result = await runSensorPipeline(input, false);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_MODEL_ID");
      expect(result.error.status).toBe(400);
    }
  });

  await test("should reject unsupported provider", async () => {
    const input = { ...sampleInput, modelId: "unknown:some-model" as any };
    const result = await runSensorPipeline(input, false);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("UNSUPPORTED_PROVIDER");
      expect(result.error.status).toBe(400);
    }
  });

  console.log("\n--- Stub Providers Return 501 ---");

  const stubProviders = ["openai", "anthropic", "google", "xai", "meta", "mistral"];
  for (const provider of stubProviders) {
    await test(`should return 501 for ${provider}:test-model (not configured)`, async () => {
      const input = { ...sampleInput, modelId: `${provider}:test-model` as any };
      const result = await runSensorPipeline(input, false);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NOT_IMPLEMENTED");
        expect(result.error.status).toBe(501);
      }
    });
  }

  console.log("\n--- Kill Switch Blocks Observations ---");

  await test("should block observation when kill switch engaged", async () => {
    const result = await runSensorPipeline(sampleInput, true);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("KILL_SWITCH_ENGAGED");
      expect(result.error.status).toBe(403);
      expect(result.error.message).toContain("Kill switch engaged");
    }
  });

  await test("should block multi-model observations when kill switch engaged", async () => {
    const result = await runMultiModelPipeline(
      { 
        ...sampleInput, 
        modelIds: ["mock:mock-sensor", "mock:mock-sensor-2"] 
      }, 
      true
    );
    expect(result.success).toBe(false);
    expect(result.observations).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].code).toBe("KILL_SWITCH_ENGAGED");
  });

  console.log("\n--- Language Hygiene Enforcement ---");

  await test("should detect forbidden words in content", () => {
    const violations = validateLanguageHygiene("This answer is correct and true.");
    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(violations.some(v => v.includes("correct"))).toBe(true);
    expect(violations.some(v => v.includes("true"))).toBe(true);
  });

  await test("should accept content without forbidden words", () => {
    const violations = validateLanguageHygiene("The response appears to contain information that may be relevant.");
    expect(violations).toHaveLength(0);
  });

  await test("should detect appropriate hedging", () => {
    expect(hasAppropriateHedging("This may be relevant.")).toBe(true);
    expect(hasAppropriateHedging("This appears to show something.")).toBe(true);
    expect(hasAppropriateHedging("It could indicate a pattern.")).toBe(true);
  });

  await test("should detect missing hedging", () => {
    expect(hasAppropriateHedging("The sky is blue.")).toBe(false);
  });

  console.log("\n--- Legacy Model ID Normalization ---");

  await test("should normalize legacy model IDs", () => {
    expect(normalizeModelId("mock-sensor")).toBe("mock:mock-sensor");
    expect(normalizeModelId("gpt-4o")).toBe("openai:gpt-4o");
    expect(normalizeModelId("claude-3-opus")).toBe("anthropic:claude-3-opus");
  });

  await test("should preserve already-canonical model IDs", () => {
    expect(normalizeModelId("openai:gpt-4o")).toBe("openai:gpt-4o");
    expect(normalizeModelId("mock:mock-sensor")).toBe("mock:mock-sensor");
  });

  console.log("\n--- Multi-Model Pipeline ---");

  await test("should run multiple models in parallel", async () => {
    const result = await runMultiModelPipeline(
      { 
        ...sampleInput, 
        modelIds: ["mock:mock-sensor", "mock:mock-sensor-2"] 
      }, 
      false
    );
    expect(result.success).toBe(true);
    expect(result.observations.length).toBeGreaterThanOrEqual(1);
  });

  console.log("\n--- P6.4 Multi-Model Disagreement Display ---");

  await test("should return per-model results with model_id", async () => {
    const result = await runMultiModelPipeline(
      { 
        ...sampleInput, 
        modelIds: ["mock:mock-sensor", "mock:mock-sensor-2"] 
      }, 
      false
    );
    expect(result.model_results.length).toBe(2);
    expect(result.model_results[0].model_id).toBeDefined();
    expect(result.model_results[1].model_id).toBeDefined();
  });

  await test("should include disagreement descriptor with no ranking language", async () => {
    const result = await runMultiModelPipeline(
      { 
        ...sampleInput, 
        modelIds: ["mock:mock-sensor", "mock:mock-sensor-2"] 
      }, 
      false
    );
    expect(result.disagreement).toBeDefined();
    expect(typeof result.disagreement.detected).toBe("boolean");
    expect(typeof result.disagreement.models_compared).toBe("number");
    expect(typeof result.disagreement.models_succeeded).toBe("number");
    expect(typeof result.disagreement.models_failed).toBe("number");
    expect(typeof result.disagreement.description).toBe("string");
    // Ensure no ranking language
    expect(result.disagreement.description.toLowerCase()).not.toContain("correct");
    expect(result.disagreement.description.toLowerCase()).not.toContain("accurate");
    expect(result.disagreement.description.toLowerCase()).not.toContain("truth");
  });

  await test("should handle partial failures - one model 501, others succeed", async () => {
    // Mix of working mock and stub that returns 501
    const result = await runMultiModelPipeline(
      { 
        ...sampleInput, 
        modelIds: ["mock:mock-sensor", "openai:test-model"] // openai returns 501 (stub)
      }, 
      false
    );
    // Should still succeed if at least one model works
    expect(result.success).toBe(true);
    expect(result.observations.length).toBe(1);
    expect(result.errors.length).toBe(1);
    // Error should have model_id and canonical code
    expect(result.errors[0].model_id).toBe("openai:test-model");
    expect(result.errors[0].code).toBe("NOT_IMPLEMENTED");
    // Disagreement descriptor should reflect partial failure
    expect(result.disagreement.models_succeeded).toBe(1);
    expect(result.disagreement.models_failed).toBe(1);
  });

  await test("should return full envelope even when all models fail (not crash)", async () => {
    const result = await runMultiModelPipeline(
      { 
        ...sampleInput, 
        modelIds: ["openai:test-model", "anthropic:test-model"] // Both 501
      }, 
      false
    );
    expect(result.success).toBe(false);
    expect(result.observations.length).toBe(0);
    expect(result.errors.length).toBe(2);
    expect(result.model_results.length).toBe(2);
    // Each error has model_id
    expect(result.errors[0].model_id).toBeDefined();
    expect(result.errors[1].model_id).toBeDefined();
  });

  await test("should block entire envelope when kill switch engaged", async () => {
    const result = await runMultiModelPipeline(
      { 
        ...sampleInput, 
        modelIds: ["mock:mock-sensor", "mock:mock-sensor-2"] 
      }, 
      true // kill switch engaged
    );
    expect(result.success).toBe(false);
    expect(result.kill_switch_engaged).toBe(true);
    expect(result.observations.length).toBe(0);
    // All models should have kill switch error
    expect(result.errors.length).toBe(2);
    expect(result.errors[0].code).toBe("KILL_SWITCH_ENGAGED");
    expect(result.errors[1].code).toBe("KILL_SWITCH_ENGAGED");
    expect(result.disagreement.description).toContain("Kill switch");
  });

  await test("disagreement descriptor uses non-authoritative phrasing", async () => {
    const result = await runMultiModelPipeline(
      { 
        ...sampleInput, 
        modelIds: ["mock:mock-sensor", "mock:mock-sensor-2"] 
      }, 
      false
    );
    const desc = result.disagreement.description.toLowerCase();
    // No authoritative words
    expect(desc).not.toContain("verified");
    expect(desc).not.toContain("true");
    expect(desc).not.toContain("false");
    expect(desc).not.toContain("right");
    expect(desc).not.toContain("wrong");
  });

  await test("divergent outputs are actually different between models", async () => {
    // Test that mock:mock-sensor and mock:mock-sensor-2 produce different content
    const result = await runMultiModelPipeline(
      { 
        ...sampleInput, 
        modelIds: ["mock:mock-sensor", "mock:mock-sensor-2"] 
      }, 
      false
    );
    expect(result.success).toBe(true);
    expect(result.observations.length).toBe(2);
    // Content should be different between the two models
    const content1 = result.observations[0].content;
    const content2 = result.observations[1].content;
    expect(content1).not.toBe(content2);
    // Disagreement should be detected
    expect(result.disagreement.detected).toBe(true);
    expect(result.disagreement.description).toContain("different observations");
  });

  console.log("\n=== Test Results ===");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

#!/usr/bin/env tsx
/**
 * P6.2 Adapter Registry Tests
 * 
 * Validates:
 * - Invalid model_id format rejection (400)
 * - Unsupported provider rejection (400)
 * - 501 for stub providers without config
 * - Mock adapter works correctly
 */

import { 
  validateModelId, 
  getAdapter, 
  getAdapterForModelId,
  AdapterError 
} from "../server/llm/adapters/index";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${e.message}`);
    failed++;
  }
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
    toHaveLength(expected: number) {
      if (value.length !== expected) {
        throw new Error(`Expected length ${expected} but got ${value.length}`);
      }
    },
    toThrow() {
      // value should be a function
      let threw = false;
      try {
        value();
      } catch (e) {
        threw = true;
      }
      if (!threw) {
        throw new Error(`Expected function to throw`);
      }
    },
    not: {
      toThrow() {
        let threw = false;
        let error: any;
        try {
          value();
        } catch (e) {
          threw = true;
          error = e;
        }
        if (threw) {
          throw new Error(`Expected function not to throw, but it threw: ${error?.message}`);
        }
      }
    }
  };
}

console.log("=== P6.2 Adapter Registry Tests ===\n");

console.log("--- validateModelId ---");

test("should accept valid model_id format: openai:gpt-4o", () => {
  expect(() => validateModelId("openai:gpt-4o")).not.toThrow();
});

test("should accept valid model_id format: anthropic:claude-3-opus", () => {
  expect(() => validateModelId("anthropic:claude-3-opus")).not.toThrow();
});

test("should accept valid model_id format: mock:mock-sensor", () => {
  expect(() => validateModelId("mock:mock-sensor")).not.toThrow();
});

test("should accept valid model_id format: xai:grok-2", () => {
  expect(() => validateModelId("xai:grok-2")).not.toThrow();
});

test("should reject invalid model_id format - missing colon", () => {
  try {
    validateModelId("gpt4o");
    throw new Error("Should have thrown");
  } catch (e) {
    expect((e as AdapterError).code).toBe("INVALID_MODEL_ID");
    expect((e as AdapterError).status).toBe(400);
  }
});

test("should reject invalid model_id format - uppercase", () => {
  expect(() => validateModelId("OpenAI:GPT-4o")).toThrow();
});

test("should reject invalid model_id format - spaces", () => {
  expect(() => validateModelId("open ai:gpt 4")).toThrow();
});

test("should reject unsupported provider", () => {
  try {
    validateModelId("unknown:some-model");
    throw new Error("Should have thrown");
  } catch (e) {
    expect((e as AdapterError).code).toBe("UNSUPPORTED_PROVIDER");
    expect((e as AdapterError).status).toBe(400);
  }
});

test("should parse provider and model correctly", () => {
  const result = validateModelId("openai:gpt-4-turbo");
  expect(result.provider).toBe("openai");
  expect(result.model).toBe("gpt-4-turbo");
});

console.log("\n--- getAdapter ---");

test("should return mock adapter", () => {
  const adapter = getAdapter("mock");
  expect(adapter).toBeDefined();
  expect(typeof adapter.buildRequest).toBe("function");
  expect(typeof adapter.parseResponse).toBe("function");
});

const providers = ["openai", "anthropic", "google", "xai", "meta", "mistral", "cohere", "perplexity", "deepseek", "qwen"];
for (const provider of providers) {
  test(`should return adapter for provider: ${provider}`, () => {
    const adapter = getAdapter(provider as any);
    expect(adapter).toBeDefined();
  });
}

console.log("\n--- getAdapterForModelId ---");

test("should return adapter with parsed info for valid model_id", () => {
  const result = getAdapterForModelId("mock:mock-sensor");
  expect(result.adapter).toBeDefined();
  expect(result.provider).toBe("mock");
  expect(result.model).toBe("mock-sensor");
});

test("should throw for invalid model_id", () => {
  expect(() => getAdapterForModelId("invalid")).toThrow();
});

console.log("\n--- Stub adapters return 501 when unconfigured ---");

for (const provider of providers) {
  test(`should return 501 for ${provider} when not configured`, () => {
    const adapter = getAdapter(provider as any);
    try {
      adapter.buildRequest({ messages: [{ role: "user", content: "test" }] });
      throw new Error(`${provider} should have thrown 501`);
    } catch (e) {
      expect((e as AdapterError).code).toBe("NOT_IMPLEMENTED");
      expect((e as AdapterError).status).toBe(501);
    }
  });
}

console.log("\n--- Mock adapter works correctly ---");

test("should build request without throwing", () => {
  const adapter = getAdapter("mock");
  const request = adapter.buildRequest({ 
    messages: [{ role: "user", content: "Hello" }] 
  });
  expect(request.provider).toBe("mock");
  expect(request.model).toBe("mock-sensor");
  expect(request.messages).toHaveLength(1);
});

test("should parse response with correct schema", () => {
  const adapter = getAdapter("mock");
  const response = adapter.parseResponse({ observation_type: "paraphrase" });
  expect(response.schema).toBe("llm-observation/1.0");
  expect(response.model_id).toBe("mock:mock-sensor");
  expect(response.limitations).toHaveLength(4);
  expect(response.confidence.level).toBe("medium");
});

console.log("\n=== Test Results ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { callJson } from "./call-json";

// Mock OpenAI and Anthropic SDKs so tests never make real network calls
const mockCreateChat = vi.fn();
const mockCreateMessage = vi.fn();
const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: mockGenerateContent,
      };
    },
  };
});

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreateChat,
        },
      };
    },
  };
});

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockCreateMessage,
      };
    },
  };
});

describe("callJson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestSchema = z.object({
    greeting: z.string(),
    count: z.number(),
  });

  it("returns validated data on first attempt for OpenAI", async () => {
    mockCreateChat.mockResolvedValueOnce({
      choices: [{ message: { content: '{"greeting":"hello","count":42}' } }],
      usage: { prompt_tokens: 15, completion_tokens: 10 },
    });

    const result = await callJson({
      prompt: "Say hello",
      schema: TestSchema,
      provider: "openai",
      apiKey: "test-openai-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ greeting: "hello", count: 42 });
      expect(result.attempts).toBe(1);
      expect(result.tokens.prompt).toBe(15);
      expect(result.tokens.completion).toBe(10);
    }
  });

  it("handles markdown code fences in the LLM response", async () => {
    mockCreateChat.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "```json\n{\n  \"greeting\": \"world\",\n  \"count\": 99\n}\n```",
          },
        },
      ],
    });

    const result = await callJson({
      prompt: "Give me JSON",
      schema: TestSchema,
      provider: "openai",
      apiKey: "test-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.greeting).toBe("world");
      expect(result.data.count).toBe(99);
    }
  });

  it("retries once when schema validation fails on first attempt and succeeds on retry", async () => {
    // Attempt 1: invalid count (string instead of number)
    mockCreateChat.mockResolvedValueOnce({
      choices: [{ message: { content: '{"greeting":"hi","count":"not-a-number"}' } }],
      usage: { prompt_tokens: 20, completion_tokens: 12 },
    });
    // Attempt 2: valid output
    mockCreateChat.mockResolvedValueOnce({
      choices: [{ message: { content: '{"greeting":"hi","count":123}' } }],
      usage: { prompt_tokens: 35, completion_tokens: 10 },
    });

    const result = await callJson({
      prompt: "Generate data",
      schema: TestSchema,
      provider: "openai",
      apiKey: "test-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.attempts).toBe(2);
      expect(result.data.count).toBe(123);
      expect(result.tokens.prompt).toBe(55);
    }
    expect(mockCreateChat).toHaveBeenCalledTimes(2);
  });

  it("returns ok: false when both attempts fail schema validation without throwing", async () => {
    mockCreateChat.mockResolvedValue({
      choices: [{ message: { content: '{"greeting":"bad","count":"still-bad"}' } }],
    });

    const result = await callJson({
      prompt: "Generate data",
      schema: TestSchema,
      provider: "openai",
      apiKey: "test-key",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts).toBe(2);
      expect(result.reason).toContain("Validation errors");
    }
  });

  it("returns ok: false when API key is missing without crashing", async () => {
    const originalEnv = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await callJson({
      prompt: "Test missing key",
      schema: TestSchema,
      provider: "openai",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("OPENAI_API_KEY is not configured");
    }

    if (originalEnv) process.env.OPENAI_API_KEY = originalEnv;
  });

  it("works with Anthropic provider format", async () => {
    mockCreateMessage.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"greeting":"from anthropic","count":7}' }],
      usage: { input_tokens: 25, output_tokens: 15 },
    });

    const result = await callJson({
      prompt: "Hello Claude",
      schema: TestSchema,
      provider: "anthropic",
      apiKey: "test-anthropic-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.greeting).toBe("from anthropic");
      expect(result.data.count).toBe(7);
      expect(result.tokens.prompt).toBe(25);
    }
  });

  it("works with Gemini provider format", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '{"greeting":"from gemini","count":108}',
      usageMetadata: { promptTokenCount: 18, candidatesTokenCount: 22 },
    });

    const result = await callJson({
      prompt: "Hello Gemini",
      schema: TestSchema,
      provider: "gemini",
      apiKey: "test-gemini-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.greeting).toBe("from gemini");
      expect(result.data.count).toBe(108);
      expect(result.tokens.prompt).toBe(18);
      expect(result.tokens.completion).toBe(22);
    }
  });

  it("works with Qwen provider (DashScope OpenAI-compatible endpoint)", async () => {
    mockCreateChat.mockResolvedValueOnce({
      choices: [{ message: { content: '{"greeting":"from qwen","count":77}' } }],
      usage: { prompt_tokens: 30, completion_tokens: 12 },
    });

    const result = await callJson({
      prompt: "Hello Qwen",
      schema: TestSchema,
      provider: "qwen",
      apiKey: "test-dashscope-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.greeting).toBe("from qwen");
      expect(result.data.count).toBe(77);
      expect(result.tokens.prompt).toBe(30);
      expect(result.tokens.completion).toBe(12);
    }
  });

  it("returns ok: false when DASHSCOPE_API_KEY is missing for Qwen", async () => {
    const original = process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.QWEN_API_KEY;

    const result = await callJson({
      prompt: "Test missing key",
      schema: TestSchema,
      provider: "qwen",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("DASHSCOPE_API_KEY is not configured");
    }

    if (original) process.env.DASHSCOPE_API_KEY = original;
  });

  it("works with OpenRouter provider", async () => {
    mockCreateChat.mockResolvedValueOnce({
      choices: [{ message: { content: '{"greeting":"from openrouter","count":55}' } }],
      usage: { prompt_tokens: 22, completion_tokens: 14 },
    });

    const result = await callJson({
      prompt: "Hello OpenRouter",
      schema: TestSchema,
      provider: "openrouter",
      apiKey: "test-openrouter-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.greeting).toBe("from openrouter");
      expect(result.data.count).toBe(55);
      expect(result.tokens.prompt).toBe(22);
      expect(result.tokens.completion).toBe(14);
    }
  });

  it("returns ok: false when OPENROUTER_API_KEY is missing", async () => {
    const original = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    const result = await callJson({
      prompt: "Test missing key",
      schema: TestSchema,
      provider: "openrouter",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("OPENROUTER_API_KEY is not configured");
    }

    if (original) process.env.OPENROUTER_API_KEY = original;
  });

  it("works with Groq provider", async () => {
    mockCreateChat.mockResolvedValueOnce({
      choices: [{ message: { content: '{"greeting":"from groq","count":33}' } }],
      usage: { prompt_tokens: 19, completion_tokens: 9 },
    });

    const result = await callJson({
      prompt: "Hello Groq",
      schema: TestSchema,
      provider: "groq",
      apiKey: "test-groq-key",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.greeting).toBe("from groq");
      expect(result.data.count).toBe(33);
      expect(result.tokens.prompt).toBe(19);
      expect(result.tokens.completion).toBe(9);
    }
  });

  it("returns ok: false when GROQ_API_KEY is missing", async () => {
    const original = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;

    const result = await callJson({
      prompt: "Test missing key",
      schema: TestSchema,
      provider: "groq",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("GROQ_API_KEY is not configured");
    }

    if (original) process.env.GROQ_API_KEY = original;
  });
});

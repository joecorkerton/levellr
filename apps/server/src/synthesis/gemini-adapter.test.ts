import assert from "node:assert/strict";
import test from "node:test";
import { GEMINI_RESPONSE_SCHEMA, synthesizeSentimentPulse, type GenerateContentRequest, type GeminiModelClient } from "./gemini-adapter.js";
import type { ConversationEvidencePack } from "../retrieval/conversation-pack.js";

const parsed = { originalQuery: "What excites players?", searchQuery: "excites players", intent: "excitement" as const, dateWindow: { days: 2, start: "2026-08-10T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" } };
function pack(): ConversationEvidencePack {
  const turn = (id: string, rootId: string, role: "evidence" | "context", excerpt: string) => ({ id, rootId, author: { id: `author-${id}`, name: `Author ${id}` }, channel: "general", timestamp: "2026-08-11T00:00:00.000Z", reply_to: null, role, excerpt });
  return { status: "ready", retrievalMode: "bm25", parsedQuery: parsed, conversations: [
    { rootId: "root-a", evidence: [turn("evidence-a", "root-a", "evidence", "The new map is fantastic")], context: [turn("context-a", "root-a", "context", "Old context")], omittedOlderAncestorCount: 0 },
    { rootId: "root-b", evidence: [turn("evidence-b", "root-b", "evidence", "The restored mode feels great")], context: [], omittedOlderAncestorCount: 0 },
  ], viewer: [] , sourceTextCharacters: 50, requestEnvelopeCharacters: 100 };
}
function model(text: string | undefined, calls: GenerateContentRequest[] = [], errors: unknown[] = []): GeminiModelClient {
  return { async generateContent(request) { calls.push(request); const error = errors.shift(); if (error) throw error; return { text }; } };
}
function answer(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({ findings: [{ theme: "Map design", stance: "positive", rationale: "Players are excited by the new map.", supportingCitations: [{ id: "evidence-a", rootId: "root-a" }], rebuttingCitations: [] }], ...overrides });
}

test("constructs a bounded schema-constrained request without retrieval internals", async () => {
  const calls: GenerateContentRequest[] = [];
  const result = await synthesizeSentimentPulse({ managerQuery: parsed.originalQuery, evidencePack: pack() }, { apiKey: "test", client: model(answer(), calls), sleep: async () => {} });
  assert.equal(result.status, "ready");
  assert.equal(calls[0].model, "gemini-2.5-flash");
  assert.equal(calls[0].config.responseMimeType, "application/json");
  assert.deepEqual(calls[0].config.responseSchema, GEMINI_RESPONSE_SCHEMA);
  assert.match(calls[0].contents, /evidence-a/);
  assert.match(calls[0].contents, /context is non-citable/);
  assert.doesNotMatch(calls[0].contents, /score|rank|raw dataset/i);
  assert.match(calls[0].contents, /Old context/);
});

test("converts only validated citations and hydrates safe display metadata", async () => {
  const result = await synthesizeSentimentPulse({ managerQuery: "q", evidencePack: pack() }, { client: model(answer()), sleep: async () => {} });
  assert.equal(result.status, "ready");
  if (result.status === "ready") assert.deepEqual(result.findings[0].supportingCitations[0], { id: "evidence-a", rootId: "root-a", author: { id: "author-evidence-a", name: "Author evidence-a" }, channel: "general", timestamp: "2026-08-11T00:00:00.000Z", excerpt: "The new map is fantastic" });
});

test("rejects context, unknown, mismatched-root, duplicate-conversation, and malformed citations", async (t) => {
  for (const [name, finding] of [
    ["context", { supportingCitations: [{ id: "context-a", rootId: "root-a" }] }],
    ["unknown", { supportingCitations: [{ id: "missing", rootId: "root-a" }] }],
    ["mismatched root", { supportingCitations: [{ id: "evidence-a", rootId: "root-b" }] }],
    ["same conversation twice", { supportingCitations: [{ id: "evidence-a", rootId: "root-a" }, { id: "evidence-a", rootId: "root-a" }] }],
  ] as const) {
    await t.test(name, async () => {
      const result = await synthesizeSentimentPulse({ managerQuery: "q", evidencePack: pack() }, { client: model(answer({ findings: [{ theme: "x", stance: "positive", rationale: "r", ...finding, rebuttingCitations: [] }] })), sleep: async () => {} });
      assert.equal(result.status, "invalid_model_output");
    });
  }
});

test("maps missing credentials, quota, provider, and invalid output failures", async () => {
  const missing = await synthesizeSentimentPulse({ managerQuery: "q", evidencePack: pack() });
  assert.equal(missing.status, "llm_unavailable");
  assert.equal((await synthesizeSentimentPulse({ managerQuery: "q", evidencePack: pack() }, { client: model(undefined), sleep: async () => {} })).status, "invalid_model_output");
  assert.equal((await synthesizeSentimentPulse({ managerQuery: "q", evidencePack: pack() }, { client: model(undefined, [], [{ status: 429 }]), sleep: async () => {} })).status, "llm_quota_exhausted");
  assert.equal((await synthesizeSentimentPulse({ managerQuery: "q", evidencePack: pack() }, { client: model(undefined, [], [{ status: 401 }]), sleep: async () => {} })).status, "llm_unavailable");
});

test("does not retry a transient provider failure more than once", async () => {
  const calls: GenerateContentRequest[] = [];
  const result = await synthesizeSentimentPulse({ managerQuery: "q", evidencePack: pack() }, { client: model(undefined, calls, [{ status: 503 }, { status: 503 }]), sleep: async () => {} });
  assert.equal(result.status, "llm_unavailable");
  assert.equal(calls.length, 2);
});

test("retries one transient provider failure, then returns the validated result", async () => {
  const calls: GenerateContentRequest[] = [];
  const result = await synthesizeSentimentPulse({ managerQuery: "q", evidencePack: pack() }, { client: model(answer(), calls, [{ status: 503 }]), sleep: async () => {} });
  assert.equal(result.status, "ready");
  assert.equal(calls.length, 2);
});

test("rejects forbidden quantitative or global claims and requires rebuttal for mixed stance", async () => {
  for (const value of [answer({ findings: [{ theme: "x", stance: "positive", rationale: "100% agree", supportingCitations: [{ id: "evidence-a", rootId: "root-a" }], rebuttingCitations: [] }] }), answer({ findings: [{ theme: "x", stance: "mixed", rationale: "disagreement", supportingCitations: [{ id: "evidence-a", rootId: "root-a" }], rebuttingCitations: [] }] })]) {
    assert.equal((await synthesizeSentimentPulse({ managerQuery: "q", evidencePack: pack() }, { client: model(value), sleep: async () => {} })).status, "invalid_model_output");
  }
});

import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { createApp, type ServerConfig } from "./app.js";
import { createBM25Index, type BM25Index, type CommunityMessage } from "./retrieval/bm25.js";
import { type SynthesisResult } from "./synthesis/gemini-adapter.js";

const config: ServerConfig = { port: 0, clientOrigin: "http://localhost:5173", answerModel: "test-model", embeddingModel: "test" };
const messages: CommunityMessage[] = [
  { id: "root-a", community_id: "test", channel: "chat", author: { id: "a", name: "Fox" }, timestamp: "2026-08-11T10:00:00.000Z", text: "The new sailing update is fantastic", reactions: [], reply_to: null },
  { id: "root-b", community_id: "test", channel: "chat", author: { id: "b", name: "Owl" }, timestamp: "2026-08-11T11:00:00.000Z", text: "I love the new sailing update", reactions: [], reply_to: null },
];
async function withServer(app: ReturnType<typeof createApp>, run: (baseUrl: string) => Promise<void>) {
  const server = createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No test address");
  try { await run(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

function readyResult(pack: any): SynthesisResult {
  return { status: "ready", retrievalMode: "bm25", parsedQuery: pack.parsedQuery, findings: [{ theme: "Sailing", stance: "positive", rationale: "Players praise sailing.", supportingCitations: [{ ...pack.conversations[0].evidence[0], excerpt: pack.conversations[0].evidence[0].excerpt }], rebuttingCitations: [] }], viewer: pack.viewer };
}

test("health reports the grounded flow", async () => {
  await withServer(createApp(config, { messages, retrievalIndex: createBM25Index(messages), synthesize: async ({ evidencePack }) => readyResult(evidencePack) }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok", service: "community-pulse-api", queryStatus: "grounded_answer_ready" });
  });
});

test("runs BM25 before synthesis and exposes only validated grounded material", async () => {
  let searched = false; let called = 0;
  const index = createBM25Index(messages);
  const retrieval: BM25Index = { latestTimestamp: index.latestTimestamp, size: index.size, search(query) { searched = query === "What is sailing?"; return index.search(query); } };
  await withServer(createApp(config, { messages, retrievalIndex: retrieval, synthesize: async ({ evidencePack }) => { called += 1; assert.equal(evidencePack.status, "ready"); return readyResult(evidencePack); } }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "What is sailing?" }) });
    const payload = await response.json();
    assert.equal(response.status, 200); assert.equal(searched, true); assert.equal(called, 1); assert.equal(payload.status, "ready"); assert.equal(payload.retrievalMode, "bm25");
    assert.equal(payload.findings[0].supportingCitations[0].id, "root-b"); assert.equal("score" in payload, false); assert.equal("prompt" in payload, false);
  });
});

test("skips Gemini when evidence is insufficient and returns a typed safe state", async () => {
  let called = false;
  const oneMessage = [messages[0]];
  await withServer(createApp(config, { messages: oneMessage, retrievalIndex: createBM25Index(oneMessage), synthesize: async () => { called = true; throw new Error("must not call"); } }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "What is sailing?" }) });
    const payload = await response.json();
    assert.equal(response.status, 200); assert.equal(payload.status, "insufficient_evidence"); assert.equal(called, false); assert.equal(payload.retrievalMode, "bm25"); assert.equal(payload.inspectableCandidates[0].id, "root-a");
  });
});

test("returns each typed synthesis failure without exposing model internals", async () => {
  for (const status of ["llm_unavailable", "llm_quota_exhausted", "invalid_model_output"] as const) {
    const app = createApp(config, { messages, retrievalIndex: createBM25Index(messages), synthesize: async ({ evidencePack }) => ({ status, message: `safe ${status}`, retrievalMode: "bm25", parsedQuery: evidencePack.parsedQuery, conversations: evidencePack.conversations, viewer: evidencePack.viewer }) });
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "What is sailing?" }) });
      const payload = await response.json();
      assert.equal(response.status, 200); assert.equal(payload.status, status); assert.equal(payload.message, `safe ${status}`); assert.equal("contents" in payload, false);
    });
  }
});

test("rejects an empty manager query", async () => {
  const app = createApp(config, { messages, retrievalIndex: createBM25Index(messages) });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: " " }) });
    assert.equal(response.status, 400); assert.deepEqual(await response.json(), { status: "error", code: "INVALID_QUERY", message: "Enter a manager query before asking Community Pulse." });
  });
});

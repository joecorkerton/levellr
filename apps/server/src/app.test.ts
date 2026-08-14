import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { createApp, type ServerConfig } from "./app.js";
import { createBM25Index, type CommunityMessage } from "./retrieval/bm25.js";

const testConfig: ServerConfig = {
  port: 0,
  clientOrigin: "http://localhost:5173",
  geminiApiKey: undefined,
  answerModel: "gemini-2.5-flash",
  embeddingModel: "gemini-embedding-001",
};

const testMessages: CommunityMessage[] = [
  {
    id: "msg_1",
    community_id: "comm_test",
    channel: "game-chat",
    author: { id: "user_1", name: "HiddenFox" },
    timestamp: "2026-08-13T14:00:00.000Z",
    text: "I am excited about the remastered sailing update",
    reactions: [],
    reply_to: null,
  },
];

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(createApp(testConfig, { retrievalIndex: createBM25Index(testMessages) }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Test server did not expose a TCP address");
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await closeServer(server);
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("the health endpoint reports that BM25 retrieval is ready", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      service: "community-pulse-api",
      queryStatus: "retrieval_ready",
    });
  });
});

test("the query endpoint returns inspectable BM25 candidates, not a grounded answer", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "What are players excited about?" }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, "retrieved");
    assert.equal(payload.retrievalMode, "bm25");
    assert.equal(payload.code, "RETRIEVAL_READY");
    assert.equal(payload.candidates[0].source.id, "msg_1");
    assert.equal(payload.candidates[0].source.author.name, "HiddenFox");
    assert.match(payload.message, /no grounded answer/i);
  });
});

test("the query endpoint makes no-results explicit", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "quantum bananas" }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      status: "empty",
      code: "NO_RESULTS",
      retrievalMode: "bm25",
      message: "No Community message candidates matched this query and time window.",
      query: {
        originalQuery: "quantum bananas",
        searchQuery: "quantum bananas",
        intent: "unknown",
        dateWindow: null,
      },
      candidates: [],
    });
  });
});

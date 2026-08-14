import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { createApp, type ServerConfig } from "./app.js";

const testConfig: ServerConfig = {
  port: 0,
  clientOrigin: "http://localhost:5173",
  geminiApiKey: undefined,
  answerModel: "gemini-2.5-flash",
  embeddingModel: "gemini-embedding-001",
};

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(createApp(testConfig));
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

test("the health endpoint reports that the scaffold is running", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      service: "community-pulse-api",
      queryStatus: "not_ready",
    });
  });
});

test("the query endpoint returns an explicit pre-integration result", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "What are players excited about?" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "not_ready",
      code: "QUERY_NOT_READY",
      message:
        "Community Pulse answers are not connected yet. Retrieval and grounded synthesis will be added next.",
    });
  });
});

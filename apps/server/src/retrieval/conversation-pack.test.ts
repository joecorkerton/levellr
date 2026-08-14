import assert from "node:assert/strict";
import test from "node:test";
import { prepareConversationEvidencePack, type EvidencePackInput } from "./conversation-pack.js";
import { createBM25Index, loadCommunityMessages, type BM25Candidate, type CommunityMessage, type ParsedManagerQuery } from "./bm25.js";

const parsed: ParsedManagerQuery = { originalQuery: "test", searchQuery: "test", intent: "unknown", dateWindow: { days: 2, start: "2026-08-10T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" } };
function message(id: string, timestamp: string, text: string, overrides: Partial<CommunityMessage> = {}): CommunityMessage {
  return { id, community_id: "community", channel: "general", author: { id: `author-${id}`, name: `Author ${id}` }, timestamp, text, reactions: [], reply_to: null, ...overrides };
}
function input(messages: CommunityMessage[], candidates: BM25Candidate[], query = parsed): EvidencePackInput {
  return { retrievalMode: "bm25", parsedQuery: query, candidates, messages };
}
function candidate(source: CommunityMessage, rank: number, score = 10 - rank): BM25Candidate { return { source, rank, score }; }

test("drops dangling, cross-channel, future-parent, and cyclic reply chains", () => {
  const root = message("root", "2026-08-10T01:00:00.000Z", "root");
  const dangling = message("dangling", "2026-08-10T02:00:00.000Z", "dangling", { reply_to: "missing" });
  const cross = message("cross", "2026-08-10T02:00:00.000Z", "cross", { reply_to: "root", channel: "other" });
  const future = message("future", "2026-08-10T00:00:00.000Z", "future", { reply_to: "root" });
  const cycleA = message("cycle-a", "2026-08-10T03:00:00.000Z", "a", { reply_to: "cycle-b" });
  const cycleB = message("cycle-b", "2026-08-10T04:00:00.000Z", "b", { reply_to: "cycle-a" });
  const result = prepareConversationEvidencePack(input([root, dangling, cross, future, cycleA, cycleB], [candidate(root, 1), candidate(dangling, 2), candidate(cross, 3), candidate(future, 4), candidate(cycleA, 5)]));
  assert.equal(result.status, "insufficient_evidence");
  assert.deepEqual(result.viewer[0].turns.map((turn) => turn.id), ["root"]);
});

test("ranks conversations by representative score, selects two turns, and applies diversity caps", () => {
  const messages = [
    message("a1", "2026-08-10T01:00:00.000Z", "same text", { author: { id: "u1", name: "One" }, channel: "one" }),
    message("a2", "2026-08-10T02:00:00.000Z", "reply", { author: { id: "u2", name: "Two" }, channel: "one", reply_to: "a1" }),
    message("b1", "2026-08-10T03:00:00.000Z", "other", { author: { id: "u3", name: "Three" }, channel: "two" }),
    message("c1", "2026-08-10T04:00:00.000Z", "same text", { author: { id: "u4", name: "Four" }, channel: "three" }),
  ];
  const result = prepareConversationEvidencePack(input(messages, [candidate(messages[2], 1, 5), candidate(messages[0], 2, 9), candidate(messages[1], 3, 8), candidate(messages[3], 4, 4)], { ...parsed, dateWindow: null }));
  assert.equal(result.status, "ready");
  assert.deepEqual(result.conversations.map((conversation) => conversation.rootId), ["a1", "b1"]);
  assert.deepEqual(result.conversations[0].evidence.map((turn) => turn.id), ["a1", "a2"]);
  assert.ok(result.conversations.every((conversation) => conversation.evidence.length <= 2));
});

test("hydrates root and older ancestors as context, while viewer labels all turns", () => {
  const root = message("root", "2026-08-01T00:00:00.000Z", "old root");
  const oldReply = message("old", "2026-08-09T00:00:00.000Z", "old reply", { reply_to: "root" });
  const current = message("current", "2026-08-11T00:00:00.000Z", "current", { reply_to: "old" });
  const other = message("other", "2026-08-11T01:00:00.000Z", "other");
  const result = prepareConversationEvidencePack(input([root, oldReply, current, other], [candidate(current, 1), candidate(other, 2)]));
  assert.equal(result.status, "ready");
  assert.deepEqual(result.conversations[0].context.map((turn) => turn.id), ["root", "old"]);
  assert.deepEqual(result.viewer[0].turns.map((turn) => [turn.id, turn.role]), [["root", "context"], ["old", "context"], ["current", "evidence"]]);
  assert.equal(result.viewer[0].turns.find((turn) => turn.id === "current")?.role, "evidence");
});

test("projects the issue 02 fixture retrieval candidates without network or model access", async () => {
  const messages = await loadCommunityMessages();
  const index = createBM25Index(messages);
  for (const query of [
    "Across the supplied corpus, what have players been excited about in Tides Remastered?",
    "What frustrations are still surfacing around Bushido and its final update in the last 7 days?",
    "What Tides Remastered features are players hoping will be restored or preserved in the last 3 days?",
  ]) {
    const search = index.search(query);
    const result = prepareConversationEvidencePack({ retrievalMode: "bm25", parsedQuery: search.parsedQuery, candidates: search.candidates, messages });
    assert.ok(result.status === "ready" || result.status === "insufficient_evidence");
    assert.ok(result.viewer.length <= 6);
  }
});

test("requires two qualifying conversations and keeps source text bounded", () => {
  const long = "x".repeat(2000);
  const one = message("one", "2026-08-11T00:00:00.000Z", long);
  const two = message("two", "2026-08-11T01:00:00.000Z", "y".repeat(2000), { author: { id: "u2", name: "Two" }, channel: "other" });
  const result = prepareConversationEvidencePack(input([one, two], [candidate(one, 1), candidate(two, 2)], { ...parsed, dateWindow: null }));
  assert.equal(result.status, "ready");
  assert.equal(result.conversations[0].evidence[0].excerpt.length, 600);
  assert.ok(result.sourceTextCharacters <= 12600);
  assert.ok(result.requestEnvelopeCharacters <= 20000);
  const insufficient = prepareConversationEvidencePack(input([one], [candidate(one, 1)], { ...parsed, dateWindow: null }));
  assert.equal(insufficient.status, "insufficient_evidence");
});

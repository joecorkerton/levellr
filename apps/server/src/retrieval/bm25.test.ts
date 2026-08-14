import assert from "node:assert/strict";
import test from "node:test";
import {
  BM25_LEXICON_V1,
} from "./lexicon.js";
import {
  createBM25Index,
  loadCommunityMessages,
  normalizeBM25Text,
  parseManagerQuery,
  type CommunityMessage,
} from "./bm25.js";

function message(
  id: string,
  timestamp: string,
  text: string,
  overrides: Partial<CommunityMessage> = {},
): CommunityMessage {
  return {
    id,
    community_id: "comm_test",
    channel: "game-chat",
    author: { id: `user_${id}`, name: `User ${id}` },
    timestamp,
    text,
    reactions: [],
    reply_to: null,
    ...overrides,
  };
}

test("normalizes BM25 text with NFKC, lowercase, punctuation replacement, and whitespace collapse", () => {
  assert.equal(normalizeBM25Text("  ＴＩＤＥＳ—Remastered!!!\nCan't   wait  "), "tides remastered can t wait");
});

test("exports the immutable v1 BM25 lexicon in normalized form", () => {
  assert.equal(BM25_LEXICON_V1.version, "v1");
  assert.deepEqual(BM25_LEXICON_V1.stopWords, [
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "i", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was", "what", "with",
  ]);
  assert.deepEqual(BM25_LEXICON_V1.excitementMarkers, [
    "excited", "exciting", "hype", "hyped", "love", "looking forward", "can t wait",
  ]);
  assert.deepEqual(BM25_LEXICON_V1.frustrationMarkers, [
    "bug", "bugs", "broken", "crash", "crashes", "crashing", "disappointed", "error", "errors", "frustrated", "frustrating", "issue", "issues", "underwhelming",
  ]);
});

test("parses a dataset-relative last-N-days window and removes only the date phrase", () => {
  const parsed = parseManagerQuery(
    "What are players excited about in the last 3 days?",
    "2026-08-13T14:00:00.000Z",
  );

  assert.equal(parsed.searchQuery, "what are players excited about in the");
  assert.equal(parsed.intent, "excitement");
  assert.deepEqual(parsed.dateWindow, {
    days: 3,
    start: "2026-08-10T14:00:00.000Z",
    end: "2026-08-13T14:00:00.000Z",
  });
});

test("orders equal BM25 scores by timestamp descending and id ascending", () => {
  const index = createBM25Index([
    message("msg_b", "2026-08-12T12:00:00.000Z", "pirate sailing"),
    message("msg_a", "2026-08-12T12:00:00.000Z", "pirate sailing"),
    message("msg_c", "2026-08-11T12:00:00.000Z", "pirate sailing"),
  ]);

  assert.deepEqual(index.search("pirate sailing").candidates.map((candidate) => candidate.source.id), [
    "msg_a",
    "msg_b",
    "msg_c",
  ]);
});

test("returns no candidates explicitly for a query with no indexed terms", () => {
  const index = createBM25Index([message("msg_1", "2026-08-13T14:00:00.000Z", "sailing")]);
  const result = index.search("quantum bananas");

  assert.deepEqual(result.candidates, []);
  assert.equal(result.parsedQuery.intent, "unknown");
});

test("retrieves all three issue 02 fixture questions locally and applies their windows", async () => {
  const messages = await loadCommunityMessages();
  const index = createBM25Index(messages);
  const fixtures = [
    {
      query: "Across the supplied corpus, what have players been excited about in Tides Remastered?",
      expectedIntent: "excitement",
    },
    {
      query: "What frustrations are still surfacing around Bushido and its final update in the last 7 days?",
      expectedIntent: "frustration",
    },
    {
      query: "What Tides Remastered features are players hoping will be restored or preserved in the last 3 days?",
      expectedIntent: "unknown",
    },
  ] as const;

  for (const fixture of fixtures) {
    const result = index.search(fixture.query);
    assert.equal(result.parsedQuery.intent, fixture.expectedIntent);
    assert.ok(result.candidates.length > 0, fixture.query);
    assert.ok(result.candidates.length <= 20);
    assert.deepEqual(result.candidates.map((candidate) => candidate.rank), result.candidates.map((_, index) => index + 1));
    assert.ok(result.candidates.every((candidate) => candidate.source.text.length > 0));

    if (result.parsedQuery.dateWindow) {
      const start = Date.parse(result.parsedQuery.dateWindow.start);
      const end = Date.parse(result.parsedQuery.dateWindow.end);
      assert.ok(result.candidates.every((candidate) => {
        const timestamp = Date.parse(candidate.source.timestamp);
        return timestamp >= start && timestamp <= end;
      }));
    }
  }
});

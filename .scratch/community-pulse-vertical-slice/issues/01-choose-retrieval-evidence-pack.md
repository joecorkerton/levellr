# Choose the retrieval and evidence-pack approach

Type: grilling
Status: resolved
Blocked by: none

## Question

Within a local 25,555-message JSON export and a 90-minute timebox, what retrieval approach should select an evidence pack for an excitement/frustration question (including `last N days`)?

Decide the simplest hybrid embeddings-plus-local-Postgres approach that keeps results relevant, repeatable, and inspectable, and set the candidate/evidence limits the LLM may receive.

## Answer

The ideal end state is a hybrid retrieval pipeline: Gemini embeddings in local Postgres/`pgvector` plus a dependency-free BM25 index. Deliver it in two stages so a grounded BM25-only path works before any database, embedding, or vector setup. Do not use a hosted vector service or an LLM to choose sources.

### Delivery sequence

1. [Build the BM25-first retrieval path](07-build-bm25-first-retrieval.md) is the required retrieval slice. It loads the supplied export locally, deterministically parses the Manager query and Sentiment time window, runs BM25, and returns its top 20 date-filtered Community message candidates with `retrievalMode: "bm25"`. It requires neither Gemini credentials nor Postgres and is not a degraded result.
2. The Conversation projection and evidence-pack rules in issue 05 consume that BM25 candidate list unchanged. The first working manager-query flow must be useful, inspectable, and fixture-tested with this path alone.
3. [Add the optional local vector upgrade](09-add-local-vector-retrieval.md) comes last, after the BM25-backed grounded-answer gate in issue 08. Only after the BM25-backed flow works does it add embeddings, local Postgres/`pgvector`, top-40 semantic candidates, and reciprocal-rank fusion. Any unavailable, stale, or partial vector state falls back to the working `bm25` mode rather than blocking the answer.

### Target hybrid upgrade (issue 09)

1. Run one local Postgres/pgvector instance for the demo. Store the complete message record in `community_messages` with `id` as the primary key, `timestamp` as `timestamptz`, the channel/author/text/reaction/reply fields, `embedding_model`, `embedding_hash`, and `embedding vector(768)`. Use an exact cosine-distance scan for the 25,555-message corpus rather than an approximate index; defer HNSW until a measured corpus-size problem exists. Keep the export id and metadata alongside every vector so every result remains inspectable.
2. Seed the database once with resumable batches of 100 messages using Gemini `gemini-embedding-001`. Embed message text as `RETRIEVAL_DOCUMENT` and manager queries as `RETRIEVAL_QUERY`, requesting 768 dimensions. Cache by message id plus a SHA-256 of the message text and commit each successful batch, so a retry does not re-embed unchanged messages. Reserve at most 25 minutes of the 90-minute exercise for Postgres bootstrap and seeding; only enable semantic retrieval when every message has the current model/hash, otherwise use the working BM25 path. Keep the key server-side in an environment variable; never send it to the React client.
3. Parse the manager query deterministically before retrieval:
   - recognise `last N days` and set `windowEnd` to the latest timestamp in the dataset (`2026-08-13T14:00:00Z` for this export), not the machine clock;
   - include messages with `timestamp >= windowEnd - N * 24 hours` in both retrieval paths;
   - when no window is present, search the complete export;
   - classify `excitement` or `frustration` from a fixed lexicon and remove the date phrase before retrieval (and, later, before embedding the query).
4. Run two date-filtered searches: the vector SQL query returns its top 40 by exact cosine distance, with `timestamp DESC, id ASC` as stable secondary ordering, and the dependency-free BM25 index returns its top 20 using `k1 = 1.2`, `b = 0.75`, with the same secondary ordering for equal scores. Both paths use the query after removing the date phrase. BM25 normalizes with Unicode NFKC, lowercase, punctuation-to-space, and whitespace collapse; its standard score is `sum(idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * docLength / averageDocLength)))`, using one versioned stop-word and intent lexicon. Add `+2` for an exact multi-word phrase, `+0.5` for an intent marker plus at least three descriptive non-marker terms, and subtract `0.5` from messages with at most two normalized tokens.
5. Merge and deduplicate the two ranked lists, then rank the union with weighted reciprocal rank fusion: `0.6 / (60 + vectorRank) + 0.4 / (60 + bm25Rank)`, where `vectorRank` and `bm25Rank` are 1-based and an item absent from a list contributes `0` for that component. Use timestamp descending and stable message id as final tie-breakers. The merged candidate pool is capped at 50. If Gemini or pgvector is unavailable, stale, or only partially seeded, use the BM25 top 20 with `retrievalMode: "bm25"` and continue with the same evidence limits; do not synthesize a grounded answer from the query alone.
6. Build the evidence pack greedily from the merged pool, removing duplicate text after the same Unicode NFKC/lowercase/punctuation-to-space/whitespace-collapse normalization and enforcing absolute caps of two messages per author and four per channel. Return fewer than 12 when those caps or the candidate pool leave fewer records; never relax the caps just to fill the pack.

### Candidate and model-input limits

- **BM25-first candidates:** 20 maximum from BM25.
- **Hybrid-upgrade candidates:** 40 maximum from pgvector plus 20 from BM25; the server-side fused pool is capped at 50.
- **Conversation model material:** issue 05 supersedes the former message-only serialization. It permits at most six Conversation blocks, twelve cited in-window evidence turns at 600 characters each, and eighteen non-citable older context turns at 300 characters each (12,600 source-text characters total). The model never receives raw candidate lists or the full export.

The synthesis prompt should receive only the manager query, parsed window/intent, retrieval mode, and the Conversation blocks defined in issue 05. Each evidence turn retains its export id, pseudonymous author, channel, ISO timestamp, reply relationship, and excerpt; context turns are labelled and non-citable. If retrieval finds no candidates or conversation packing leaves fewer than two qualifying Conversations, skip the model call and return the explicit `insufficient_evidence` result; never ask the model to invent a pulse from the query alone.

This is intentionally a staged retrieval decision, not a theme taxonomy: BM25 is the complete first path, while hybrid retrieval is an optional quality upgrade. Corpus-specific themes should be discovered from the evidence by the constrained synthesis step and verified in the later fixture ticket. The output remains a sentiment pulse, not an ungrounded pulse or recommendation.

## Comments

- The response contract now makes the Conversation rather than an isolated Community message the synthesis unit. [Set the conversation-aware evidence pack](05-set-conversation-aware-evidence-pack.md) will define the bounded projection and supersede the message-only model-input limits where necessary.

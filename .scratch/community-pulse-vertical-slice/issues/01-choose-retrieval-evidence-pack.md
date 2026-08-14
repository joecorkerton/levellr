# Choose the retrieval and evidence-pack approach

Type: grilling
Status: resolved
Blocked by: none

## Question

Within a local 25,555-message JSON export and a 90-minute timebox, what retrieval approach should select an evidence pack for an excitement/frustration question (including `last N days`)?

Decide the simplest hybrid embeddings-plus-local-Postgres approach that keeps results relevant, repeatable, and inspectable, and set the candidate/evidence limits the LLM may receive.

## Answer

Use a hybrid retrieval pipeline: Gemini embeddings in a local Postgres database with `pgvector` as the semantic primary, plus the existing small BM25 index as an exact-match guardrail and service fallback. Do not use a hosted vector service or an LLM to choose sources. This pays the one-time embedding/setup cost while covering both paraphrases and exact game, bug, and feature terms.

### Retrieval decision

1. Run one local Postgres/pgvector instance for the demo. Store the complete message record in `community_messages` with `id` as the primary key, `timestamp` as `timestamptz`, the channel/author/text/reaction/reply fields, `embedding_model`, `embedding_hash`, and `embedding vector(768)`. Create an HNSW index using cosine distance. Keep the export id and metadata alongside every vector so every result remains inspectable.
2. Seed the database once with resumable batches using Gemini `gemini-embedding-001`. Embed message text as `RETRIEVAL_DOCUMENT` and manager questions as `RETRIEVAL_QUERY`, requesting 768 dimensions. Cache by message id plus a SHA-256 of the message text and commit each successful batch, so a retry does not re-embed unchanged messages. Keep the key server-side in an environment variable; never send it to the React client.
3. Parse the manager query deterministically before retrieval:
   - recognise `last N days` and set `windowEnd` to the latest timestamp in the dataset (`2026-08-13T14:00:00Z` for this export), not the machine clock;
   - include messages with `timestamp >= windowEnd - N * 24 hours` in both retrieval paths;
   - when no window is present, search the complete export;
   - classify `excitement` or `frustration` from a fixed lexicon and remove the date phrase before embedding the query.
4. Run two date-filtered searches: the vector SQL query returns its top 40 by cosine distance, and the dependency-free BM25 index returns its top 20 using `k1 = 1.2`, `b = 0.75`. BM25 uses Unicode NFKC, lowercase, punctuation-to-space, whitespace collapse, and fixed stop-word/intent lexicons. Add `+2` for an exact multi-word phrase, `+0.5` for an intent marker plus at least three descriptive non-marker terms, and subtract `0.5` from messages with at most two normalized tokens.
5. Merge and deduplicate the two ranked lists, then rank the union with weighted reciprocal rank fusion: `0.6 / (60 + vectorRank) + 0.4 / (60 + bm25Rank)`, treating a missing rank as zero. Use timestamp descending and stable message id as final tie-breakers. The merged candidate pool is capped at 50. If Gemini or pgvector is unavailable, use the BM25 top 50 and surface the degraded retrieval mode; do not invent or silently return an ungrounded answer.
6. Build the evidence pack greedily from the merged pool, removing normalized duplicate text and enforcing absolute caps of two messages per author and four per channel. Return fewer than 12 when those caps or the candidate pool leave fewer records; never relax the caps just to fill the pack.

### Limits sent to the model

- **Vector candidates:** 40 maximum from pgvector.
- **Lexical candidates:** 20 maximum from BM25; the merged server-side candidate pool is capped at 50.
- **Evidence:** 12 maximum messages are sent to the model, or fewer when diversity/deduplication leaves fewer matches.
- **Excerpt size:** truncate each evidence text to 600 characters after preserving its stable message id and source metadata. The model therefore receives at most 12 inspectable source records (roughly 7,200 message characters), never the raw candidate lists or the full export.

The synthesis prompt should receive only the manager query, parsed window/intent, retrieval mode, and those evidence records. Each record must include the export `id`, pseudonymous author name, channel, ISO timestamp, and excerpt. If retrieval finds no candidates, skip the model call and return an explicit no-evidence result; never ask the model to invent a pulse from the query alone.

This is intentionally a hybrid retrieval decision, not a theme taxonomy: corpus-specific themes should be discovered from the evidence by the constrained synthesis step and verified in the later fixture ticket.

## Comments

# Add the optional local vector retrieval upgrade

Type: task
Status: ready-for-agent
Blocked by: 08

## Goal

After the BM25-backed manager-query flow is working and validated, add the planned local semantic-retrieval quality upgrade without making it a prerequisite for the demo. BM25 remains the reliable baseline and fallback.

## Scope

- Run one local Postgres/`pgvector` instance and store each complete Community message in `community_messages`: stable id primary key, timestamp, channel, author, text, reactions, reply target, embedding model/hash, and `vector(768)` embedding. Use an exact cosine-distance scan; do not add HNSW without a measured corpus-size need.
- Seed Gemini `gemini-embedding-001` document embeddings in resumable batches of 100, keyed by message id plus SHA-256 text hash. Embed queries with `RETRIEVAL_QUERY`; keep `GEMINI_API_KEY` server-side.
- Enable semantic retrieval only when every export message has the current embedding model and hash. Then retrieve the top 40 date-filtered vector candidates and merge them with the existing top 20 BM25 candidates using issue 01's weighted reciprocal-rank fusion, stable tie-breakers, and 50-message cap.
- Pass the existing issue 05 Conversation projection the fused candidate pool unchanged and expose `retrievalMode: "hybrid"` only when that complete state is available.
- If Postgres, `pgvector`, Gemini credentials, the seed job, or embedding completeness is unavailable, return the working BM25 top 20 with `retrievalMode: "bm25"`. Do not block the manager-query flow, make a second model call, or ask the LLM to select sources.

## Deferred

- Hosted vector infrastructure, approximate indexing, autonomous source selection, recommendation features, and any change to the conversation-aware evidence budget.
- Replacing or weakening BM25; semantic retrieval is an additive quality upgrade.

## Acceptance criteria

- The complete BM25-first test suite still passes when Postgres and Gemini credentials are absent.
- With a complete current seed, vector search returns at most 40 date-filtered candidates and the deterministic RRF merge returns at most 50 candidates.
- A partial, stale, or unavailable seed produces the same typed BM25 behavior as issue 07, not an error or a falsely labelled hybrid result.
- Embeddings and API credentials remain server-only; stored records retain the metadata needed to inspect every selected Community message.
- Add focused tests for readiness gating, RRF/deduplication/tie ordering, and fallback, then run the full typecheck, test suite, and production build.

## Dependencies

Do not start until [Connect BM25 retrieval to the grounded answer flow](08-connect-bm25-to-grounded-answer.md) has passed its acceptance criteria, including the complete BM25-first suite and live smoke check. This is the final optional retrieval enhancement for the timeboxed slice.

## Comments

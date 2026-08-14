# Map: Grounded Community Pulse Vertical Slice

Labels: wayfinder:map

## Destination

Lock a 90-minute, demoable React frontend and TypeScript-backend vertical slice: a manager asks an excitement or frustration question about all supplied community messages or the last N days and receives a grounded answer with inspectable cited excerpts.

The map ends with an implementation-ready slice and acceptance bar, not a complete community analytics product.

## Notes

- Domain language lives in [`CONTEXT.md`](../../CONTEXT.md); consult the `/grilling` and `/domain-modeling` skills when resolving human decisions.
- Standing choices: prioritize sentiment pulse (excitement and frustration), show cited excerpts, use retrieval before constrained LLM synthesis, support all messages plus `last N days` relative to the latest dataset timestamp, and use hybrid checks (contract tests plus a live-answer smoke check).
- Stack constraint: TypeScript backend and React frontend. Timebox is 90 minutes; choose boring local dependencies and document cuts rather than building bonus functionality. One local Postgres/pgvector instance is now in scope for hybrid retrieval.
- The provided content-recommendation example ("What should we post?") is not part of this slice.

## Decisions so far

- [02 — Profile the corpus for sentiment fixtures](issues/02-profile-corpus-for-sentiment-fixtures.md): the selected fixtures cover broad Tides Remastered excitement, recent Bushido update frustrations, and current Remastered feature-preservation concerns. Mixed reception to the final update is a grounded alternate framing, not an additional sentiment category.

- [01 — retrieval and evidence pack](issues/01-choose-retrieval-evidence-pack.md#answer): Gemini `gemini-embedding-001` in local Postgres/pgvector plus BM25 guardrail/fallback; latest-dataset-relative date windows; 40 vector + 20 lexical candidates merged to 50; and at most 12 source excerpts (600 characters each) sent to the model.
- [03 — LLM interface and fallback](issues/03-verify-llm-interface-and-fallback.md#answer): `gemini-2.5-flash` returns schema-constrained JSON through `@google/genai`; validate `response.text` at runtime; fail closed on missing credentials, quota, malformed output, or insufficient evidence; one live smoke request passed.
- [Set the answer and evaluation contract](issues/04-set-answer-and-evaluation-contract.md#answer): synthesize reply-tree Conversation profiles qualitatively, hydrate old ancestors only as context, require two qualifying Conversations, and make cited evidence inspectable through a thread viewer.

## Not yet specified

<!-- No in-scope fog at this resolution; live decisions are child tickets. -->

## Out of scope

- Content/post recommendations — the agreed slice proves sentiment understanding, not marketing planning.
- Follow-up conversation memory, authentication, user/community management, dashboards, and persistent analytics storage — each expands beyond one grounded Q&A flow.
- Hosted vector infrastructure, autonomous agents, and a general-purpose semantic analytics platform — one local, inspectable pgvector store is sufficient for the timebox.

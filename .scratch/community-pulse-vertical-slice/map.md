# Map: Grounded Community Pulse Vertical Slice

Labels: wayfinder:map

## Destination

Lock a 90-minute, demoable React frontend and TypeScript-backend vertical slice: a manager asks an excitement or frustration question about all supplied community messages or the last N days and receives a grounded answer with inspectable cited excerpts.

The map ends with an implementation-ready slice and acceptance bar, not a complete community analytics product.

## Notes

- Domain language lives in [`CONTEXT.md`](../../CONTEXT.md); consult the `/grilling` and `/domain-modeling` skills when resolving human decisions.
- Standing choices: prioritize sentiment pulse (excitement and frustration), show cited excerpts, use retrieval before constrained LLM synthesis, support all messages plus `last N days` relative to the latest dataset timestamp, and use contract tests plus a live-answer smoke check.
- Stack constraint: TypeScript backend and React frontend. Timebox is 90 minutes; choose boring local dependencies and document cuts rather than building bonus functionality. Local Postgres/pgvector is an optional final retrieval upgrade, not a prerequisite.
- The provided content-recommendation example ("What should we post?") is not part of this slice.
- Execution order: start with the application scaffold, then make BM25 retrieval work independently. Only add vector infrastructure, embeddings, and fusion after the BM25-backed manager-query flow is useful and validated.

## Decisions so far

- [02 — Profile the corpus for sentiment fixtures](issues/02-profile-corpus-for-sentiment-fixtures.md): the selected fixtures cover broad Tides Remastered excitement, recent Bushido update frustrations, and current Remastered feature-preservation concerns. Mixed reception to the final update is a grounded alternate framing, not an additional sentiment category.

- [01 — retrieval and evidence pack](issues/01-choose-retrieval-evidence-pack.md#answer): first ship dependency-free BM25 with latest-dataset-relative date windows and its top 20 candidates; then optionally add Gemini embeddings in local Postgres/pgvector and fuse 40 vector + 20 lexical candidates to 50. Its former message-only evidence-pack step is superseded by issue 05.
- [03 — LLM interface and fallback](issues/03-verify-llm-interface-and-fallback.md#answer): `gemini-2.5-flash` returns schema-constrained JSON through `@google/genai`; validate `response.text` at runtime; fail closed on missing credentials, quota, malformed output, or insufficient evidence; one live smoke request passed.
- [Set the answer and evaluation contract](issues/04-set-answer-and-evaluation-contract.md#answer): synthesize reply-tree Conversation profiles qualitatively, hydrate old ancestors only as context, require two qualifying Conversations, and make cited evidence inspectable through a thread viewer.
- [Set the conversation-aware evidence pack](issues/05-set-conversation-aware-evidence-pack.md#answer): collapse ranked message hits to six score-neutral Conversation blocks; cite at most two current turns per Conversation while retaining global author/channel diversity; add at most three non-citable old ancestors per Conversation; and cap serialized source text at 12,600 characters.

## Build sequence

1. [06 — Scaffold the React and TypeScript application](issues/06-scaffold-react-and-typescript-app.md)
2. [07 — Build the BM25-first retrieval path](issues/07-build-bm25-first-retrieval.md)
3. [08 — Connect BM25 retrieval to the grounded answer flow](issues/08-connect-bm25-to-grounded-answer.md)
4. [09 — Add the optional local vector retrieval upgrade](issues/09-add-local-vector-retrieval.md) only if time remains.

## Not yet specified

<!-- No in-scope fog at this resolution; live decisions are child tickets. -->

## Out of scope

- Content/post recommendations — the agreed slice proves sentiment understanding, not marketing planning.
- Follow-up conversation memory, authentication, user/community management, dashboards, and persistent analytics storage — each expands beyond one grounded Q&A flow.
- Hosted vector infrastructure, autonomous agents, and a general-purpose semantic analytics platform. The local pgvector work in issue 09 is optional, not a substitute for a working BM25-first path.

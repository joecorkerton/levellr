# Connect BM25 retrieval to the grounded answer flow

Type: task
Status: ready-for-agent
Blocked by: 07

## Goal

Make the independently working BM25 path useful end-to-end before any vector work: a Manager query returns either a grounded Sentiment pulse with inspectable Conversation evidence or a typed safe failure. This ticket implements the existing response and conversation-pack decisions; it does not add semantic retrieval.

## Scope

- Feed issue 07's `retrievalMode: "bm25"` candidates into the deterministic issue 05 Conversation projection. Resolve only valid channel-local, ordered, acyclic reply trees; select at most six distinct qualifying Conversations, at most two cited in-window evidence turns per Conversation, and at most three non-citable older ancestors per Conversation.
- Serialize only the bounded Conversation blocks from issue 05 to Gemini. Enforce the 12,600-character source-text budget, retain ids/relationships/roles, and reject any citation absent from selected in-window evidence.
- Implement the issue 04 response contract and its two-qualifying-Conversation gate. Preserve typed `insufficient_evidence`, `llm_unavailable`, `llm_quota_exhausted`, and `invalid_model_output` failures; no result may present unvalidated synthesis as grounded.
- Render the answer's cited excerpts and ordered reply-tree viewer. Clearly distinguish evidence, older context, and turns not sent to synthesis.
- Add contract tests for reply-tree grouping, dangling targets, date-window qualification, ancestor hydration, pack diversity, citation validity, and one-Conversation-per-theme aggregation. Run the three issue 02 fixtures through the BM25-backed flow, then perform the documented schema-validated live Gemini smoke check when credentials are available.

## Deferred

- Embeddings, Postgres/`pgvector`, vector candidates, RRF, and all vector seed work; these belong to issue 09.
- Recommendations, dashboards, and any claim of a sentiment percentage or global score.

## Acceptance criteria

- With only `messages.json`, the BM25 index, and a valid answer-model key, the three fixture queries can produce schema-validated, citation-valid Sentiment pulses with `retrievalMode: "bm25"`.
- With no answer-model key, quota, invalid output, no candidates, or fewer than two qualifying Conversations, the API returns the specified typed safe result and never invents a pulse.
- Every displayed citation is an in-window selected evidence turn; an opened viewer preserves valid reply-tree order and labels any earlier ancestor as context.
- The project typecheck, full test suite, production build, and one live smoke check (when credentials are available) pass before issue 09 may begin.

## Dependencies

Begin only after [Build the BM25-first retrieval path](07-build-bm25-first-retrieval.md) passes. [Add the optional local vector retrieval upgrade](09-add-local-vector-retrieval.md) is blocked by this ticket so it cannot displace a working grounded BM25 demo.

## Comments

# Wire the grounded manager-query flow

Type: task
Status: ready-for-agent
Blocked by: 07, 08, 09

## Goal

Replace the scaffold's pre-integration manager-query behavior with the complete manager-facing flow: a submitted Manager query runs BM25 retrieval, prepares deterministic Conversation evidence, calls the validated Gemini synthesis adapter when enough evidence exists, and displays either an inspectable Grounded answer or a clear typed safe state.

## Scope

- Replace the placeholder query endpoint with a single request orchestration path: validate the Manager query; execute issue 07's BM25 search; pass candidates to issue 08; return `insufficient_evidence` without a model call when the pack cannot qualify; otherwise invoke issue 09 exactly once apart from its permitted transient retry.
- Define and expose a discriminated HTTP response contract for normal Sentiment pulses and `insufficient_evidence`, `llm_unavailable`, `llm_quota_exhausted`, and `invalid_model_output` states. Include retrieval mode, parsed Sentiment time window, safe evidence/viewer material, and only validated citations. Do not expose API credentials, raw model text, prompt text, or internal ranking scores.
- Update the React API client to validate the expanded response union. Update the screen to show loading, query-specific safe failures, and a successful qualitative Sentiment pulse with theme cards, stance/rationale, cited excerpts, and a citation-triggered ordered Community conversation viewer.
- In the viewer, display full valid conversation order and clearly distinguish in-window evidence, older context, and turns not sent to synthesis. Do not represent context as current evidence or candidate retrieval as a completed Sentiment pulse.
- Add endpoint and UI-level contract tests using the issue 02 fixtures and injected deterministic retrieval/adapter seams. Assert BM25 is actually invoked for a submitted query, Gemini is skipped for insufficient evidence, successful results only show validated citations, and each typed failure has a safe user-facing state.
- Run one end-to-end local smoke path against the live Gemini adapter when credentials are available, plus the normal credential-free suite, typecheck, and production build.

## Deferred

- Embeddings, Postgres/pgvector, hybrid retrieval, and RRF; these belong to issue 12.
- Follow-up memory, content recommendations, dashboards, authentication, and persistent analytics storage.

## Acceptance criteria

- A manager can submit each issue 02 fixture query and the endpoint demonstrably runs the BM25-first search before any Gemini call.
- With qualifying evidence and valid local credentials, the UI displays a citation-valid qualitative Sentiment pulse in `retrievalMode: "bm25"`; every excerpt opens the corresponding labelled Community conversation.
- With no candidates, fewer than two qualifying Conversations, missing key, quota, provider failure, or invalid model output, the endpoint and UI return the defined safe state without inventing a pulse.
- The full test suite, typecheck, production build, and documented live smoke check pass before issue 11 begins.

## Dependencies

Begin only after issue 07's retrieval, issue 08's deterministic pack, and issue 09's Gemini adapter have passed their acceptance criteria. Issue 11 evaluates this working BM25-first manager flow; issue 12 may enhance retrieval only after that baseline is complete.

## Comments

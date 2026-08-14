# Build the Gemini answer-synthesis adapter

Type: task
Status: ready-for-agent
Blocked by: 08

## Goal

Build the server-only, testable Gemini boundary that turns one deterministic Conversation evidence pack into a runtime-validated Sentiment pulse draft or a typed model failure. The adapter must synthesize from supplied evidence; it must never search Community messages or select sources itself.

## Scope

- Add the pinned server dependency and a narrow injected-client interface around the verified `@google/genai` `generateContent` call. Keep `GEMINI_API_KEY` and the selected answer model server-only; retain `gemini-2.5-flash` as the default and do not silently switch models.
- Define the application response schema from issue 04 and derive the Gemini JSON response schema from the same contract. The normal result must contain qualitative theme findings, stance, rationale, conversation roots, and supporting/rebutting citations where applicable; it must not contain percentages, global sentiment, or raw-message-count claims.
- Construct a fixed, bounded prompt from the Manager query, parsed intent/time window, and the issue 08 serialized Conversation blocks. State that only supplied in-window `evidence` ids may be cited, context is non-citable, disagreement must be retained, and a Conversation may contribute once per theme. Do not include retrieval scores, unselected messages, or a raw dataset.
- Consume only `response.text`, require non-empty JSON, parse it, validate it at runtime against the application contract, and verify every returned citation/root pair against the supplied evidence pack. Reject model prose, unknown ids, context citations, duplicate Conversation contributions, and any invalid shape.
- Map missing credentials/auth failures to `llm_unavailable`; map quota/rate-limit failures to `llm_quota_exhausted`; and map empty, malformed, or contract-invalid output to `invalid_model_output`. For transient provider/network failures, permit one 250-ms capped-backoff retry within a 10-second deadline, then return `llm_unavailable`. Preserve safe inspectable evidence, but never return raw model output as a grounded answer.
- Write unit/contract tests through a fake injected model client for request construction, JSON-schema configuration, valid response conversion, citation validation, every failure category, and the single permitted retry. Tests must not need credentials or network access.
- Document a manual, schema-validated live smoke command using ignored local credentials. It should exercise a minimal literal pack and confirm only that the configured model returns a valid cited result; it must not persist credentials or raw responses.

## Deferred

- BM25 search, date parsing, reply-tree projection, and evidence-pack selection; those are issue 07 and issue 08.
- Express request handling, HTTP response composition, the React client, cited-excerpt cards, and the Conversation viewer; those are issue 10.
- Gemini embeddings, `gemini-embedding-001`, and vector retrieval; those are issue 12.

## Acceptance criteria

- Given a literal valid evidence pack, the adapter makes a schema-constrained Gemini request containing only the Manager query, parsed request metadata, and selected Conversation blocks, then returns only a runtime- and citation-validated result.
- Given missing credentials, quota, provider failure, malformed output, or invalid citations, the adapter returns the specified typed failure and no unvalidated answer.
- Automated adapter tests are credential-free and network-free; typecheck and production build pass. One documented live smoke request passes when a local key is available.

## Dependencies

Begin after issue 08 establishes the typed serialized Conversation evidence-pack boundary. Issue 10 is the only caller that connects this adapter to manager-facing HTTP and UI behavior.

## Comments

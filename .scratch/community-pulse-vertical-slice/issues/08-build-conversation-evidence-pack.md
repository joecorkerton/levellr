# Build the conversation-aware evidence pack

Type: task
Status: ready-for-agent
Blocked by: 07

## Goal

Turn the ranked, date-filtered Community message candidates returned by the BM25 search into the bounded, inspectable Conversation evidence pack that a later Gemini synthesis request can safely consume. This issue builds deterministic source selection only; it makes no LLM request and renders no final Sentiment pulse.

## Scope

- Define the typed boundary from issue 07's ranked candidate list to a Conversation evidence pack. Preserve the selected retrieval mode and source records, but keep retrieval ranks and scores server-side and out of the model-facing material.
- Resolve valid Community conversations through channel-local, timestamp-ordered, acyclic reply chains. Drop a candidate with a dangling or invalid chain instead of assigning it by text or proximity; a valid root is its own Conversation.
- Apply issue 05's score-neutral Conversation selection: rank each Conversation by its representative hit, select at most six qualifying Conversations, and select at most two in-window evidence turns per Conversation while enforcing normalized-text deduplication, two-per-author, and four-per-channel caps globally.
- Hydrate only the bounded pre-window ancestor context required by issue 05: at most three unique older ancestors per selected Conversation, labelled `context`, never citable, and never counted as current evidence. Produce the complete ordered Conversation viewer data separately from the prompt-bounded pack, labelling every turn as evidence, context, or not sent to synthesis.
- Serialize the selected blocks in Conversation rank order with stable ids, root ids, author, channel, timestamp, reply relationship, role, excerpts, and omitted-ancestor count. Enforce the 12,600-character source-text limit and 20,000-character request-envelope limit without truncating required metadata.
- Return a typed `insufficient_evidence` preparation outcome when fewer than two qualifying Conversations survive. It must retain safe inspectable candidates where applicable and must not invoke Gemini.
- Add deterministic tests using literal reply trees and the issue 02 corpus fixtures for invalid/dangling chains, window qualification, stable Conversation ties, diversity caps, ancestor hydration, serialization limits, viewer labelling, and the two-Conversation gate.

## Deferred

- Installing or calling `@google/genai`, prompt construction, response-schema validation, retry behavior, and all model failure mapping; these belong to issue 09.
- Wiring a Manager query endpoint to this pack, rendering a Sentiment pulse, or invoking any LLM; these belong to issue 10.
- Embeddings, Postgres/pgvector, RRF, and semantic retrieval; these belong to issue 12.

## Acceptance criteria

- The BM25 top-20 output from issue 07 deterministically becomes either a bounded Conversation evidence pack or typed `insufficient_evidence`, without credentials, network access, or an LLM call.
- Every model-eligible citation target is an in-window selected evidence turn in a valid Community conversation; older ancestors are explicitly context and cannot become citations.
- The pack contains no more than six Conversations, twelve evidence turns, eighteen context turns, and 12,600 source-text characters; its separate viewer data preserves the complete valid ordered reply tree.
- The fixture queries exercise the pack against actual retrieval candidates, and the new tests plus typecheck and production build pass.

## Dependencies

Begin after issue 07 provides the dependency-free BM25 retrieval contract. Its exported evidence-pack boundary is consumed by issue 09's Gemini adapter and issue 10's HTTP/UI orchestration.

## Comments

# Set the answer and evaluation contract

Type: grilling
Status: resolved
Blocked by: 01, 02, 03

## Question

Given the chosen evidence-pack approach, observed corpus themes, and verified model interface, define the response contract and the hybrid evaluation acceptance bar.

Decide: the fields shown in a grounded answer; citation validation rules; how a no-evidence result behaves; the three fixture questions; automated invariants for date filtering, real-source citations, and response shape; and the live-LLM smoke-check procedure.

## Answer

Use a conversation-centred response contract. A normal result is a qualitative Sentiment pulse, not a scorecard: it reports the parsed manager intent and date window, retrieval mode, and an ordered list of theme findings. Each finding contains a theme name, `positive`/`negative`/`mixed`/`neutral` stance, concise rationale, and one or two cited in-window turns. It identifies the Conversation root for each citation and exposes the corresponding ordered reply-tree viewer. Hydrated ancestor turns may be shown in that viewer, but are labelled **context** and neither affect the profile nor count as current evidence.

The synthesizer receives Conversation material and returns a Conversation sentiment profile per material theme: stance, rationale, supporting citation(s), and rebutting citation(s) when the stance is mixed. It must preserve disagreement rather than reduce turns to independent message labels. The final pulse groups compatible profiles qualitatively; a Conversation can contribute once per theme, and the response must not assert a percentage, global sentiment score, majority, or raw-message count.

### Citation and failure rules

- A displayed evidence citation must identify a supplied in-window Community message, its conversation root, pseudonymous author, channel, date, and text excerpt. It may only cite a stable id present in the server-selected evidence pack and must be rejected otherwise.
- The conversation viewer preserves timestamp order and reply relationships. Older hydrated ancestors are visually distinct from evidence and cannot substantiate a current-sentiment claim.
- Return `insufficient_evidence` without calling the model unless retrieval yields at least two distinct qualifying Conversations. There is deliberately no minimum turn count. The result says a reliable pulse cannot be determined; it never says the community has no opinion.
- Preserve the existing typed LLM failures (`llm_unavailable`, `llm_quota_exhausted`, and `invalid_model_output`): no response state may present unvalidated synthesis as grounded. Retrieved inspectable evidence may remain available where safe.

### Evaluation acceptance bar

The handoff must contain deterministic contract tests for: transitive reply-tree grouping (including depth beyond direct replies), dangling targets, conversation-level deduplication, date-window qualification, ancestor hydration that does not change current sentiment, one-Conversation-per-theme aggregation, response shape, and citation validity. It must exercise the seeded-corpus fixtures for Tides Remastered excitement, recent Bushido frustration, and recently preserved Tides Remastered features, then run one live schema-validated Gemini smoke request. None of those checks may encode a fabricated sentiment percentage.

The corpus supports the grouping decision: valid reply edges are channel-local, acyclic, and ordered after their parent; chains reach depth 15. Seven replies have missing targets and must remain unassigned rather than being attached by timestamp or text. A recent time window can contain replies with earlier parents, so ancestor hydration is required.

The prior message-level evidence-pack decision now needs a bounded Conversation projection and serialization rule. That follow-up is captured in [Set the conversation-aware evidence pack](05-set-conversation-aware-evidence-pack.md); it is not resolved in this ticket.

## Comments

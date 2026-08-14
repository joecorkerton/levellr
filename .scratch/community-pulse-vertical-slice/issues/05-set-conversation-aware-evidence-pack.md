# Set the conversation-aware evidence pack

Type: grilling
Status: resolved
Blocked by: none

## Question

The existing message-level retrieval decision ranks individual Community messages, but the response contract now derives sentiment from reply-tree Community conversations. Within the 90-minute slice, decide how ranked message hits become a bounded pack of distinct Conversations: projection and ranking, ancestor hydration, transcript/context limits, per-conversation diversity, and the resulting model-input budget. Record which parts of the earlier message-level evidence-pack decision this supersedes without adding a new vector service or turning the model into a source selector.

## Answer

Keep retrieval message-level, then deterministically project its ranked hits into a conversation-aware evidence pack before any model call. The model receives selected Conversation blocks, never the 50-message candidate pool or retrieval scores, and it cannot add sources.

### Project and rank Conversations

1. Apply this projection after whichever issue 01 retrieval stage is active: the required BM25-first path supplies its date-filtered top 20 candidates, while the optional vector upgrade supplies the fused 50-message pool. Every candidate is therefore already in the Sentiment time window when one was requested.
2. Resolve each candidate through its `reply_to` chain. A valid edge must target an existing Community message in the same channel, occur no later than its child, and remain acyclic. Group valid candidates by the resolved root id. A candidate with a dangling or otherwise invalid chain is unassigned and is dropped; it must not become a Conversation by proximity. A root message is its own Conversation.
3. Rank each distinct Conversation by its highest-scoring retrieval candidate (its **representative hit**): BM25 score in the first stage and fused score after the optional upgrade. This deliberately gives extra hits in one reply tree no score bonus. Break ties by the representative hit's timestamp descending, then root id ascending. Retrieval scores and ranks stay server-side.
4. Traverse that list once to select at most **six** distinct qualifying Conversations. A Conversation qualifies only if it has at least one selected in-window evidence turn. If fewer than two Conversations survive the pack rules, return `insufficient_evidence` without calling Gemini.

### Select evidence turns with diversity

A selected Conversation gets its representative hit plus at most one other in-window candidate from that same reply tree: **two cited evidence turns per Conversation**, twelve total. The second turn is the highest-ranked eligible candidate by a different author where one exists; otherwise it is the highest-ranked eligible candidate. This supplies an actual reply-tree contrast without allowing a prolific Conversation to consume the pack.

The issue 01 normalized-text deduplication and absolute caps remain, but apply only to selected in-window evidence turns: at most two turns per author and four per channel across the whole pack. Check the representative hit before selecting its Conversation; if it would violate a cap or duplicate already selected evidence, skip that Conversation and continue. Apply the same rules to the optional second turn. Hydrated context never counts toward those caps, is never used to fill a missing evidence slot, and is never citable.

Each Conversation can appear once in the model input and can contribute at most once to a returned theme. This is the selection-level guard that supports the response contract's one-Conversation-per-theme aggregation; it is not a sentiment score or a substitute for preserving mixed stances.

### Hydrate bounded ancestor context

For every selected evidence turn, follow its valid parent chain only to supply ancestors older than `windowStart`. Do not add an unselected in-window turn as context: it could affect current sentiment and would have to be selected as evidence instead. For an all-corpus request there are no older ancestors to hydrate.

Hydrate at most **three unique ancestor turns per Conversation**, all marked `context`:

1. include the root when it is older than the window;
2. then alternate the nearest older ancestor on each selected evidence turn's path, deduplicating shared ancestors, until the three-turn cap is reached.

Render those retained turns in timestamp order with their `reply_to` relation. If the cap omits older ancestors, serialize an `omittedOlderAncestorCount` and preserve the supplied turns' ids and reply relationships; the model must not infer text for omitted context. Context excerpts are capped at 300 characters and the model may neither cite them nor use them as current evidence.

The viewer remains inspectable rather than prompt-bounded: opening a citation loads the complete valid ordered Community conversation and labels selected in-window turns as **evidence**, hydrated pre-window turns as **context**, and all other turns as **not sent to synthesis**. The complete viewer is not included in model input.

### Model serialization and budget

Serialize at most six blocks in Conversation-rank order. Each block contains the root id; evidence and context turn records with stable id, pseudonymous author, channel, ISO timestamp, `reply_to`, role, and excerpt; plus the omission count. Evidence turns use 600-character excerpts; context turns use 300-character excerpts. The response schema may cite only an `evidence` id from these blocks and must return its Conversation root id with every citation.

The bounded source-text budget is therefore:

| Material | Maximum | Text budget |
| --- | ---: | ---: |
| Conversations | 6 | — |
| In-window evidence turns | 6 × 2 = 12 | 12 × 600 = 7,200 characters |
| Older context turns | 6 × 3 = 18 | 18 × 300 = 5,400 characters |
| Serialized turn records | 30 | 12,600 source-text characters maximum |

With ids and other metadata this is roughly 4,500 input tokens before the fixed prompt and manager query, while keeping current evidence at the existing 7,200-character maximum. The server must keep the envelope bounded; it may omit optional second evidence turns deterministically if metadata ever pushes the serialized request past the implementation's 20,000-character request-envelope limit, but must never truncate ids, roles, timestamps, or relationships.

### Relationship to issue 01

This supersedes issue 01's final, message-only evidence-pack step: do **not** greedily send up to twelve unrelated messages directly from the merged pool, and do **not** treat its two-per-author/four-per-channel limits as a way to choose individual model sources before conversation projection. Its 12 × 600 evidence budget is retained for cited current evidence, but is now organized as six two-turn Conversation blocks and augmented by the bounded, non-citable context budget above.

All earlier retrieval decisions remain in force, now in delivery order: the BM25-first path uses query parsing, normalization, and its top-20 limit; the optional upgrade adds the 40-vector/20-BM25 limits, 50-message merged cap, RRF formula, and exact pgvector scan. The working BM25 path and optional hybrid path use the same Conversation projection and model budget. This adds neither a vector service nor an LLM source-selection step.

## Comments

# Map: Grounded Community Pulse Vertical Slice

Labels: wayfinder:map

## Destination

Lock a 90-minute, demoable React frontend and TypeScript-backend vertical slice: a manager asks an excitement or frustration question about all supplied community messages or the last N days and receives a grounded answer with inspectable cited excerpts.

The map ends with an implementation-ready slice and acceptance bar, not a complete community analytics product.

## Notes

- Domain language lives in [`CONTEXT.md`](../../CONTEXT.md); consult the `/grilling` and `/domain-modeling` skills when resolving human decisions.
- Standing choices: prioritize sentiment pulse (excitement and frustration), show cited excerpts, use retrieval before constrained LLM synthesis, support all messages plus `last N days` relative to the latest dataset timestamp, and use hybrid checks (contract tests plus a live-answer smoke check).
- Stack constraint: TypeScript backend and React frontend. Timebox is 90 minutes; choose boring local dependencies and document cuts rather than building bonus functionality.
- The provided content-recommendation example ("What should we post?") is not part of this slice.

## Decisions so far

<!-- Closed tickets only. Each links to its detailed resolution. -->

## Not yet specified

- Whether profiling the actual corpus reveals a third, genuinely distinct sentiment scenario worth retaining alongside excitement and frustration within the timebox.
- The precise citation presentation and empty/error states once the response contract and available LLM interface are known.

## Out of scope

- Content/post recommendations — the agreed slice proves sentiment understanding, not marketing planning.
- Follow-up conversation memory, authentication, user/community management, dashboards, and persistent analytics storage — each expands beyond one grounded Q&A flow.
- Vector-database infrastructure, autonomous agents, and a general-purpose semantic analytics platform — local, inspectable retrieval is sufficient for the timebox.

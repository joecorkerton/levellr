# Establish the BM25 grounded-answer evaluation baseline

Type: task
Status: ready-for-agent
Blocked by: 10

## Goal

Create a small, repeatable evaluation suite and record the working BM25-first baseline before any hybrid vector retrieval is added. It must measure whether a Manager query reaches relevant Community conversations and whether the resulting Grounded answer remains faithful to its cited evidence—not merely whether an endpoint returns successfully.

## Scope

- Define a versioned, reviewable evaluation fixture set from the issue 02 corpus profile. Start with its three Manager queries and add only enough focused fixtures to cover broad excitement, recent frustration, feature-preservation concerns, an empty/no-reliable-evidence case, and a reply whose older ancestor is context rather than current evidence.
- For every fixture, record the normalized Manager query, expected Sentiment time window and intent, a small set of known-relevant Community message or conversation identifiers, expected theme(s) or acceptable alternate framing, and explicit prohibited claims. Labels must use real supplied Community messages and preserve material mixed reception; they must not encode percentages or a fabricated majority view.
- Build a credential-free retrieval-and-pack evaluator that runs the production BM25 and Conversation evidence-pack seams. Report message-candidate recall at the top-20 limit, known-relevant Conversation coverage after projection, whether the two-Conversation gate was appropriate, diversity-cap outcomes, and citation-eligible evidence ids. Make results deterministic and machine-readable.
- Build a Grounded-answer contract evaluator that can run against recorded valid model fixtures without network access and against the live Gemini flow when a local key is available. It must verify response shape, cited-evidence and conversation-root validity, date-window compliance, context non-citability, one-Conversation-per-theme aggregation, and absence of forbidden quantitative claims.
- Add a concise human review rubric for live answers: each theme must be supported by its displayed citations, use a qualitative stance, retain material disagreement, and answer the Manager query without drifting into a content recommendation. Record the reviewer result alongside the fixture/run metadata; do not treat an LLM-as-judge score as the release gate.
- Capture the initial BM25-first result as a checked-in baseline artifact and document how to re-run it. Treat a failed structural/citation invariant or a loss of known-relevant Conversation coverage as a regression; do not declare hybrid retrieval better merely because it returns more candidates.

## Deferred

- Vector embeddings, Postgres/pgvector setup, RRF, and hybrid quality comparisons; these belong to issue 12 and must use this baseline.
- A broad benchmark corpus, automated model judging, sentiment percentages, user feedback telemetry, or a general analytics-quality platform.

## Acceptance criteria

- The suite evaluates the complete production BM25 → Conversation pack → validated-answer path with the fixture set, while retrieval and recorded-answer checks run without credentials or network access.
- The baseline artifact records deterministic retrieval/pack measures and passes all citation, date-window, context, and qualitative-claim invariants.
- The live-answer path, when credentials are available, is assessed with the documented human rubric and its result is recorded without persisting credentials or raw model content beyond the approved fixture evidence.
- The evaluation command, baseline artifact, typecheck, tests, and production build pass before issue 12 begins.

## Dependencies

Begin after issue 10 ships the complete BM25-first manager-query flow. Issue 12 must run this suite before and after its hybrid retrieval change, preserving the baseline's structural invariants and known-relevant Conversation coverage.

## Comments

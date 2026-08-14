# Build the BM25-first retrieval path

Type: task
Status: ready-for-agent
Blocked by: 06

## Goal

Turn a Manager query into an inspectable, date-filtered ranked list of Community message candidates using only a local, dependency-free BM25 index. This is the required first retrieval implementation: it must work with no Postgres instance, embedding seed job, Gemini embedding credential, or vector service.

## Scope

- Load `messages.json` locally and build an in-process BM25 index over Community message text. Keep the complete original source record with every indexed id so later evidence selection remains inspectable.
- Deterministically parse `last N days` relative to the export's latest timestamp, classify excitement/frustration using the versioned fixed lexicon, remove the date phrase before search, and apply the window before ranking.
- Implement the issue 01 BM25 normalization and scoring contract: Unicode NFKC, lowercase, punctuation-to-space, whitespace collapse, `k1 = 1.2`, `b = 0.75`, the fixed stop-word/intent lexicons, exact-multiword-phrase `+2`, descriptive-intent `+0.5`, and short-message `-0.5` adjustments.
- Return at most 20 results, ordered by score descending with `timestamp DESC, id ASC` for ties, using `retrievalMode: "bm25"`. An empty result must be explicit; it must not call Gemini or fabricate a Sentiment pulse.
- Replace the scaffold's query placeholder only as far as needed to expose a typed, inspectable retrieval result. It may show selected source candidates or an explicit pre-synthesis state, but it must not claim to answer the Manager query until the conversation-aware evidence pack and synthesis are connected.
- Add one exported `BM25_LEXICON_V1` module adjacent to the index, normalized by the same function as queries. Its immutable v1 lists are: stop words `a, an, and, are, as, at, be, by, for, from, how, i, in, is, it, of, on, or, that, the, this, to, was, what, with`; excitement markers `excited, exciting, hype, hyped, love, looking forward, can't wait`; and frustration markers `bug, bugs, broken, crash, crashes, crashing, disappointed, error, errors, frustrated, frustrating, issue, issues, underwhelming`. Test the exported version and lists rather than sourcing either at runtime.
- Add deterministic unit/contract tests for normalization, the exported lexicon/version, date windows, stable ties, fixture retrieval, and no-results behavior. Include golden score and ranked-id assertions for a small literal corpus that exercises the fixed IDF formula, complete-export corpus statistics versus the date filter, phrase bonus, intent bonus, and short-message penalty. The three fixture queries in issue 02 must exercise this path without API credentials or a database.

## Deferred

- Postgres, `pgvector`, migrations, Docker, embeddings, and reciprocal-rank fusion; these belong exclusively to issue 09.
- Conversation projection, ancestor hydration, evidence-pack selection, Gemini synthesis, citation validation, and the conversation viewer.
- Recommendations, dashboards, and persistent analytics storage.

## Acceptance criteria

- A fresh clone can run the BM25 retrieval checks without `GEMINI_API_KEY`, Postgres, Docker, or network access.
- The supplied fixture queries return inspectable Community message candidates in the requested Sentiment time window, and `last N days` uses the dataset timestamp rather than the machine clock.
- Query output is deterministic for repeated requests and exposes `retrievalMode: "bm25"`; it is never labelled degraded merely because vector search is absent.
- The query endpoint and UI never present candidate retrieval as a grounded answer or a Sentiment pulse.
- The new tests, project typecheck, and production build pass.

## Dependencies

Begin after [Scaffold the React and TypeScript application](06-scaffold-react-and-typescript-app.md) supplies the runnable API, client, and test commands. The resulting candidate list is the direct input to the conversation-aware rules in issue 05.

## Comments

import { FormEvent, useState } from "react";
import { submitManagerQuery, type QueryResponse, type QueryRetrievalResponse } from "./api";
import "./styles.css";

const starterQuestions = [
  "What have players been excited about lately?",
  "What are people frustrated about right now?",
];

export default function App() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Extract<QueryResponse, { status: "retrieved" | "empty" }> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setNotice("Enter a manager query to get started.");
      return;
    }

    setIsSubmitting(true);
    setNotice(null);
    setResult(null);

    try {
      const response = await submitManagerQuery(trimmedQuery);
      setResult(response.status === "error" ? null : response);
      if (response.status === "error") setNotice(response.message);
    } catch {
      setNotice("The local API is unavailable. Start the backend and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="/" aria-label="Community Pulse home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span>Community Pulse</span>
        </a>
        <span className="status-pill"><span className="status-dot" />BM25 retrieval</span>
      </nav>

      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Community intelligence for managers</p>
        <h1>Listen closely.<br /><em>Move with the community.</em></h1>
        <p className="hero-copy">
          Ask a question about what players are excited or frustrated about.
          Inspect the local Community message candidates selected for that question.
        </p>
      </section>

      <section className="query-card" aria-labelledby="query-title">
        <div className="card-heading">
          <div>
            <p className="section-label">Manager query</p>
            <h2 id="query-title">What would you like to understand?</h2>
          </div>
          <span className="sparkle" aria-hidden="true">✳</span>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="manager-query">Ask about the community</label>
          <textarea
            id="manager-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. What have players been frustrated about in the last few days?"
            rows={3}
          />
          <div className="form-footer">
            <span className="hint">Retrieval is inspectable; no grounded answer is synthesized yet.</span>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Searching…" : "Find candidates"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
        {notice && <p className="notice" role="status">{notice}</p>}
      </section>

      {result ? <RetrievalResult result={result} /> : (
        <section className="empty-state" aria-live="polite">
          <div className="empty-icon" aria-hidden="true">◌</div>
          <div>
            <p className="section-label">Local retrieval</p>
            <h2>Candidate retrieval is ready.</h2>
            <p>Run a manager query to inspect ranked Community messages. This slice does not present those candidates as a grounded Sentiment pulse.</p>
          </div>
        </section>
      )}

      <section className="starter-section" aria-labelledby="starter-title">
        <p className="section-label" id="starter-title">Try asking</p>
        <div className="starter-list">
          {starterQuestions.map((starterQuestion) => (
            <button key={starterQuestion} className="starter-question" onClick={() => setQuery(starterQuestion)}>
              <span>{starterQuestion}</span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      </section>

      <footer>Community Pulse <span>·</span> Local BM25 candidates, not a grounded answer</footer>
    </main>
  );
}

function RetrievalResult({ result }: { result: QueryRetrievalResponse | Extract<QueryResponse, { status: "empty" }> }) {
  const hasCandidates = result.candidates.length > 0;

  return (
    <section className="results" aria-live="polite" aria-labelledby="results-title">
      <div className="results-heading">
        <div>
          <p className="section-label">Selected Community messages</p>
          <h2 id="results-title">{hasCandidates ? `${result.candidates.length} candidates found` : "No candidates found"}</h2>
        </div>
        <span className="mode-label">{result.retrievalMode}</span>
      </div>
      <p className="result-note">{result.message}</p>
      <p className="query-meta">
        Intent: <strong>{result.query.intent}</strong>
        {result.query.dateWindow && <> · Last {result.query.dateWindow.days} days ending {formatDate(result.query.dateWindow.end)}</>}
      </p>
      {hasCandidates && (
        <ol className="candidate-list">
          {result.candidates.map((candidate) => (
            <li key={candidate.source.id} className="candidate">
              <div className="candidate-topline">
                <span>#{candidate.rank} · {candidate.source.channel}</span>
                <span>Score {candidate.score.toFixed(2)}</span>
              </div>
              <p>{candidate.source.text}</p>
              <div className="candidate-source">
                <span>{candidate.source.author.name}</span>
                <span>{formatDate(candidate.source.timestamp)}</span>
                <span>{candidate.source.id}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(timestamp));
}

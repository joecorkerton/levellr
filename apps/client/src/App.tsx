import { FormEvent, useState } from "react";
import { submitManagerQuery } from "./api";
import "./styles.css";

const starterQuestions = [
  "What have players been excited about lately?",
  "What are people frustrated about right now?",
];

export default function App() {
  const [query, setQuery] = useState("");
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

    try {
      const response = await submitManagerQuery(trimmedQuery);
      setNotice(response.message);
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
        <span className="status-pill"><span className="status-dot" />Pre-integration</span>
      </nav>

      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Community intelligence for managers</p>
        <h1 id="page-title">Listen closely.<br /><em>Move with the community.</em></h1>
        <p className="hero-copy">
          Ask a question about what players are excited or frustrated about.
          Grounded answers and inspectable conversation evidence are coming next.
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
            <span className="hint">Answers will cite the conversations behind the pulse.</span>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Checking…" : "Ask Community Pulse"}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
        {notice && <p className="notice" role="status">{notice}</p>}
      </section>

      <section className="empty-state" aria-live="polite">
        <div className="empty-icon" aria-hidden="true">◌</div>
        <div>
          <p className="section-label">Your pulse is waiting</p>
          <h2>Retrieval isn’t connected yet.</h2>
          <p>The foundation is ready. Once connected, this space will show a concise pulse with the source conversations behind it.</p>
        </div>
      </section>

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

      <footer>Community Pulse <span>·</span> A starting point for grounded community understanding</footer>
    </main>
  );
}

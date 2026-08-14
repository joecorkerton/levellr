import { FormEvent, useState } from "react";
import { submitManagerQuery, type ConversationViewer, type Finding, type QueryMetadata, type QueryResponse } from "./api";
import "./styles.css";

const starterQuestions = ["What have players been excited about lately?", "What are people frustrated about right now?"];

export default function App() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const trimmed = query.trim();
    if (!trimmed) { setNotice("Enter a manager query to get started."); return; }
    setIsSubmitting(true); setNotice(null); setResult(null);
    try {
      const response = await submitManagerQuery(trimmed);
      if (response.status === "error") { setNotice(response.message); setResult(null); }
      else setResult(response);
    }
    catch { setNotice("The local API is unavailable. Start the backend and try again."); }
    finally { setIsSubmitting(false); }
  }

  const failure = result && result.status !== "ready" && result.status !== "error" ? result : null;
  return <main className="shell">
    <nav className="topbar"><a className="brand" href="/" aria-label="Community Pulse home"><span className="brand-mark">✦</span><span>Community Pulse</span></a><span className="status-pill"><span className="status-dot" />BM25 · grounded</span></nav>
    <section className="hero"><p className="eyebrow">Community intelligence for managers</p><h1>Listen closely.<br /><em>Move with the community.</em></h1><p className="hero-copy">Ask what players are excited or frustrated about, then inspect every grounded Conversation behind the pulse.</p></section>
    <section className="query-card"><div className="card-heading"><div><p className="section-label">Manager query</p><h2>What would you like to understand?</h2></div><span className="sparkle">✳</span></div><form onSubmit={handleSubmit}><label className="sr-only" htmlFor="manager-query">Ask about the community</label><textarea id="manager-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. What have players been frustrated about in the last few days?" rows={3} /><div className="form-footer"><span className="hint">BM25 retrieval · bounded evidence · validated citations</span><button type="submit" disabled={isSubmitting}>{isSubmitting ? "Grounding…" : "Ask Community Pulse"}<span>→</span></button></div></form>{notice && <p className="notice" role="status">{notice}</p>}</section>
    {isSubmitting && <section className="empty-state" aria-live="polite"><div className="empty-icon">◌</div><div><p className="section-label">Working</p><h2>Following the Conversation…</h2><p>Retrieving evidence and checking whether it is sufficient for a grounded answer.</p></div></section>}
    {!isSubmitting && result && result.status === "ready" && <Pulse findings={result.findings} viewer={result.viewer} parsedQuery={result.parsedQuery} />}
    {!isSubmitting && failure && <SafeState result={failure} />}
    {!isSubmitting && !result && <section className="empty-state"><div className="empty-icon">◌</div><div><p className="section-label">Grounded Sentiment pulse</p><h2>Ask a question to begin.</h2><p>Your answer will show qualitative themes only when distinct Conversations and valid citations support it.</p></div></section>}
    <section className="starter-section"><p className="section-label">Try asking</p><div className="starter-list">{starterQuestions.map((question) => <button key={question} className="starter-question" onClick={() => setQuery(question)}><span>{question}</span><span>↗</span></button>)}</div></section>
    <footer>Community Pulse <span>·</span> BM25-first grounded answers</footer>
  </main>;
}

function Pulse({ findings, viewer, parsedQuery }: { findings: Finding[]; viewer: ConversationViewer[]; parsedQuery: QueryMetadata }) {
  return <section className="results" aria-live="polite"><div className="results-heading"><div><p className="section-label">Grounded Sentiment pulse</p><h2>What the community is expressing</h2></div><span className="mode-label">{parsedQuery.dateWindow ? `last ${parsedQuery.dateWindow.days} days` : "bm25"}</span></div><p className="query-meta">Intent: <strong>{parsedQuery.intent}</strong></p><div className="theme-grid">{findings.map((finding) => <article className="theme-card" key={finding.theme}><div className="theme-topline"><span className={`stance ${finding.stance}`}>{finding.stance}</span><h3>{finding.theme}</h3></div><p>{finding.rationale}</p><div className="citations">{finding.supportingCitations.map((citation) => <Citation key={citation.id} citation={citation} viewer={viewer} label="supporting" />)}{finding.rebuttingCitations.map((citation) => <Citation key={citation.id} citation={citation} viewer={viewer} label="rebutting" />)}</div></article>)}</div></section>;
}
function Citation({ citation, viewer, label }: { citation: Finding["supportingCitations"][number]; viewer: ConversationViewer[]; label: "supporting" | "rebutting" }) {
  const conversation = viewer.find((item) => item.rootId === citation.rootId);
  return <details className="citation"><summary><span>{label} · {citation.author.name} · #{citation.channel}</span><time>{formatDate(citation.timestamp)}</time></summary><blockquote>“{citation.excerpt}”</blockquote>{conversation && <Conversation conversation={conversation} />}</details>;
}
function Conversation({ conversation }: { conversation: ConversationViewer }) {
  return <div className="conversation"><p className="conversation-label">Community conversation · full order</p>{conversation.turns.map((turn) => <div className={`turn ${turn.role}`} key={turn.id}><div><strong>{turn.author.name}</strong><small>{formatDate(turn.timestamp)} · {turn.role === "not_sent_to_synthesis" ? "not sent to synthesis" : turn.role}</small></div><p>{turn.text}</p></div>)}</div>;
}
function SafeState({ result }: { result: Exclude<QueryResponse, { status: "ready" | "error" }> }) {
  const title = result.status === "insufficient_evidence" ? "Not enough evidence yet" : result.status === "llm_quota_exhausted" ? "Synthesis quota is unavailable" : result.status === "invalid_model_output" ? "The answer could not be validated" : "Synthesis is unavailable";
  return <section className="empty-state safe-state" aria-live="polite"><div className="empty-icon">!</div><div><p className="section-label">Safe state · {result.status}</p><h2>{title}</h2><p>{result.message}</p>{result.status === "insufficient_evidence" && <p>{result.inspectableCandidates.length} retrieved message candidate(s) were not presented as a Sentiment pulse.</p>}</div></section>;
}
function formatDate(timestamp: string): string { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(timestamp)); }

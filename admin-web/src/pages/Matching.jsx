import { Brain, Building2, Link2, SlidersHorizontal } from "lucide-react";
import React, { useState } from "react";
import { Badge, Dial, PanelTitle } from "../components/ui.jsx";

export default function Matching({ matches, config, setConfig, saveConfig, createManualOverride, loading, userInfo }) {
  if (!userInfo?.isMasterAdmin && !userInfo?.isInstitutionAdmin) {
    return (
      <section className="page-grid">
        <div className="panel wide" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <Building2 size={48} color="#CBD5E1" />
          <h2 style={{ marginTop: 16, color: '#0F172A' }}>You are not an admin of any institution</h2>
          <p style={{ color: '#64748B', marginTop: 8 }}>Create an institution to start seeing matching data.</p>
        </div>
      </section>
    );
  }
  const [lostItemId, setLostItemId] = useState("");
  const [foundItemId, setFoundItemId] = useState("");
  const threshold = config.minimumScore;

  return (
    <section className="page-grid">
      <div className="panel wide">
        <PanelTitle icon={Brain} title="AI matches list" action={loading ? "Loading" : `${matches.length} generated pairs`} />
        <div className="match-list">
          {!loading && matches.length === 0 && <div className="status-line">No generated matches yet.</div>}
          {matches.map((match) => (
            <article className="match-card" key={match.id}>
              <div className="match-score">
                <strong>{match.score}</strong>
                <span>score</span>
              </div>
              <div className="match-copy">
                <strong>{match.lost}</strong>
                <span>{match.owner} matched with {match.finder}</span>
                <small>{match.found}</small>
              </div>
              <div className="score-grid">
                <Dial label="Location" value={match.location} />
                <Dial label="Title" value={match.title} />
                <Dial label="Brand" value={match.brand} />
                <Dial label="Color" value={match.color} />
              </div>
              <Badge text={match.status} tone={match.status === "Strong" ? "success" : match.status === "Weak" ? "warning" : "neutral"} />
            </article>
          ))}
        </div>
      </div>
      <div className="panel">
        <PanelTitle icon={SlidersHorizontal} title="Minimum threshold" action={`${threshold}%`} />
        <div className="range-stack">
          <input
            type="range"
            min="40"
            max="95"
            value={threshold}
            onChange={(event) => setConfig((current) => ({ ...current, minimumScore: Number(event.target.value) }))}
          />
          <p>Matches below this score stay hidden from users until an admin reviews them.</p>
          <button className="primary-button" onClick={() => saveConfig(config)}>Save threshold</button>
        </div>
      </div>
      <div className="panel">
        <PanelTitle icon={Link2} title="Manual override" action="Draft" />
        <div className="override-form">
          <input placeholder="Lost item Mongo ID" value={lostItemId} onChange={(event) => setLostItemId(event.target.value)} />
          <input placeholder="Found item Mongo ID" value={foundItemId} onChange={(event) => setFoundItemId(event.target.value)} />
          <button className="primary-button" onClick={() => createManualOverride({ lostItemId, foundItemId, score: 100, notify: true })}>
            <Link2 size={16} /> Link and notify
          </button>
        </div>
      </div>
    </section>
  );
}

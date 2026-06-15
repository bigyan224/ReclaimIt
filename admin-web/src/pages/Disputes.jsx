import { AlertTriangle, Ban, Building2, Check, Eye, Flag, MessageSquareWarning } from "lucide-react";
import React from "react";
import { Badge, Info, PanelTitle } from "../components/ui.jsx";

export default function Disputes({ disputes, transcript, selectedDispute, setSelectedDispute, loadTranscript, loading, userInfo }) {
  if (!userInfo?.isMasterAdmin && !userInfo?.isInstitutionAdmin) {
    return (
      <section className="page-grid">
        <div className="panel wide" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <Building2 size={48} color="#CBD5E1" />
          <h2 style={{ marginTop: 16, color: '#0F172A' }}>You are not an admin of any institution</h2>
          <p style={{ color: '#64748B', marginTop: 8 }}>Create an institution to start seeing dispute data.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="split-layout">
      <div className="panel list-panel">
        <PanelTitle icon={MessageSquareWarning} title="Reported chats feed" action={loading ? "Loading" : `${disputes.length} chats`} />
        <div className="dispute-list">
          {!loading && disputes.length === 0 && <div className="status-line">No chats available for audit.</div>}
          {disputes.map((dispute) => (
            <button
              className={selectedDispute?.id === dispute.id ? "dispute-row active" : "dispute-row"}
              key={dispute.id}
              onClick={() => {
                setSelectedDispute(dispute);
                loadTranscript(dispute.id);
              }}
            >
              <AlertTriangle size={18} />
              <div>
                <strong>{dispute.item}</strong>
                <span>{dispute.reason}</span>
              </div>
              <Badge text={dispute.priority} tone={dispute.priority === "High" ? "danger" : "warning"} />
            </button>
          ))}
        </div>
      </div>
      <aside className="panel detail-panel">
        {transcript ? (
          <>
        <PanelTitle icon={Eye} title="Audit viewer" action={transcript.id} />
        <div className="detail-grid">
          <Info label="Reporter" value={transcript.reporter} />
          <Info label="Assigned" value={transcript.assigned} />
          <Info label="Reason" value={transcript.reason} />
          <Info label="Priority" value={transcript.priority} />
        </div>
        <div className="transcript">
          {transcript.messages.length === 0 && <div className="status-line">No messages in this transcript.</div>}
          {transcript.messages.map(([speaker, text]) => (
            <div className="message" key={`${speaker}-${text}`}>
              <strong>{speaker}</strong>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <div className="action-grid">
          <button className="primary-button">
            <Check size={16} /> Resolve
          </button>
          <button className="secondary-button">
            <Flag size={16} /> Escalate
          </button>
          <button className="danger-button">
            <Ban size={16} /> Enforce ban
          </button>
        </div>
          </>
        ) : (
          <div className="empty-state">
            <MessageSquareWarning size={24} />
            <strong>No transcript selected</strong>
            <span>{loading ? "Loading transcript..." : "Choose a chat from the feed."}</span>
          </div>
        )}
      </aside>
    </section>
  );
}

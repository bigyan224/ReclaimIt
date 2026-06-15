import { Ban, Building2, Crown, Flag, UserCog, Users } from "lucide-react";
import React from "react";
import { Badge, Info, PanelTitle } from "../components/ui.jsx";
import { initials } from "../utils/format.js";

export default function UserManagement({ users, selectedUser, setSelectedUser, updateUser, loading, userInfo }) {
  if (!userInfo?.isMasterAdmin && !userInfo?.isInstitutionAdmin) {
    return (
      <section className="page-grid">
        <div className="panel wide" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <Building2 size={48} color="#CBD5E1" />
          <h2 style={{ marginTop: 16, color: '#0F172A' }}>You are not an admin of any institution</h2>
          <p style={{ color: '#64748B', marginTop: 8 }}>Create an institution to start seeing users data.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="split-layout">
      <div className="panel list-panel">
        <PanelTitle icon={Users} title="User directory" action={loading ? "Loading" : `${users.length} users`} />
        <div className="user-grid">
          {users.map((user) => (
            <button className={selectedUser?.id === user.id ? "user-row active" : "user-row"} key={user.id} onClick={() => setSelectedUser(user)}>
              <div className="avatar">{initials(user.name)}</div>
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <Badge text={user.status} tone={user.status === "BANNED" ? "danger" : user.status === "FLAGGED" ? "warning" : "neutral"} />
            </button>
          ))}
        </div>
      </div>

      <aside className="panel detail-panel">
        {selectedUser ? (
          <>
        <PanelTitle icon={UserCog} title="User card" action={selectedUser.id} />
        <div className="profile-head">
          <div className="avatar large-avatar">{initials(selectedUser.name)}</div>
          <div>
            <h2>{selectedUser.name}</h2>
            <p>{selectedUser.email}</p>
          </div>
        </div>
        <div className="detail-grid">
          <Info label="Role" value={selectedUser.role} />
          <Info label="Status" value={selectedUser.status} />
          <Info label="Reports" value={selectedUser.reports} />
          <Info label="Claims" value={selectedUser.claims} />
          <Info label="Karma" value={`${selectedUser.karma} trust pts`} />
          <Info label="Joined" value={selectedUser.joined} />
        </div>
        <div className="action-grid">
          <button className="primary-button" onClick={() => updateUser(selectedUser.id, { role: "ADMIN" })}>
            <Crown size={16} /> Promote
          </button>
          <button className="secondary-button" onClick={() => updateUser(selectedUser.id, { status: "FLAGGED" })}>
            <Flag size={16} /> Flag
          </button>
          <button className="danger-button" onClick={() => updateUser(selectedUser.id, { status: selectedUser.status === "BANNED" ? "ACTIVE" : "BANNED" })}>
            <Ban size={16} /> {selectedUser.status === "BANNED" ? "Unban" : "Ban"}
          </button>
        </div>
          </>
        ) : (
          <div className="empty-state">
            <UserCog size={24} />
            <strong>No user selected</strong>
            <span>{loading ? "Loading users..." : "No users were returned by the API."}</span>
          </div>
        )}
      </aside>
    </section>
  );
}

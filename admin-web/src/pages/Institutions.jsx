import { Archive, Building2, ChevronRight, Mail, Plus, RefreshCw, RotateCcw, Save, Search, Shield, Users, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Badge, EmptyState, Info, PanelTitle } from "../components/ui.jsx";

const EMPTY_FORM = {
  name: "",
  slug: "",
  description: "",
  emailDomainsText: "",
  adminEmailsText: "",
  status: "ACTIVE",
};

const splitList = (text) =>
  String(text || "")
    .split(/[\n,]/g)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

const listToText = (list) => (Array.isArray(list) ? list.join(", ") : "");

const buildPayload = (form) => ({
  name: form.name.trim(),
  slug: form.slug.trim() || undefined,
  description: form.description.trim(),
  emailDomains: splitList(form.emailDomainsText),
  adminEmails: splitList(form.adminEmailsText),
  status: form.status,
});

export default function Institutions({
  institutions,
  selectedInstitution,
  members,
  membersLoading,
  loading,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  selectInstitution,
  createInstitution,
  updateInstitution,
  archiveInstitution,
  restoreInstitution,
  loadMembers,
  resetSelection,
  error,
  userInfo,
}) {
  const [mode, setMode] = useState("view");
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (selectedInstitution) {
      setMode("edit");
      setForm({
        name: selectedInstitution.name || "",
        slug: selectedInstitution.slug || "",
        description: selectedInstitution.description || "",
        emailDomainsText: listToText(selectedInstitution.emailDomains),
        adminEmailsText: listToText(selectedInstitution.adminEmails),
        status: selectedInstitution.status || "ACTIVE",
      });
    } else {
      setMode("create");
      setForm(EMPTY_FORM);
    }
  }, [selectedInstitution]);

  const emailDomainPreview = useMemo(() => splitList(form.emailDomainsText), [form.emailDomainsText]);
  const adminEmailPreview = useMemo(() => splitList(form.adminEmailsText), [form.adminEmailsText]);

  const startCreate = () => {
    resetSelection();
    setMode("create");
    setForm(EMPTY_FORM);
  };

  const cancelEdit = () => {
    if (selectedInstitution) {
      setForm({
        name: selectedInstitution.name || "",
        slug: selectedInstitution.slug || "",
        description: selectedInstitution.description || "",
        emailDomainsText: listToText(selectedInstitution.emailDomains),
        adminEmailsText: listToText(selectedInstitution.adminEmails),
        status: selectedInstitution.status || "ACTIVE",
      });
      setMode("edit");
    } else {
      setForm(EMPTY_FORM);
      setMode("create");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = buildPayload(form);
    if (!payload.name) return;

    if (mode === "edit" && selectedInstitution) {
      await updateInstitution(selectedInstitution.id, payload);
    } else {
      await createInstitution(payload);
    }
  };

  return (
    <section className="split-layout">
      <div className="panel list-panel">
        <PanelTitle
          icon={Building2}
          title="Institutions"
          action={
            <button className="add-chip" onClick={startCreate} type="button">
              <Plus size={14} /> New institution
            </button>
          }
        />

        <div className="toolbar">
          <label className="search-field">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, slug, description" />
          </label>
          <label className="select-field">
            <Shield size={16} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {["All", "ACTIVE", "INACTIVE"].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="data-table">
          {!loading && institutions.length === 0 && <EmptyState title="No institutions yet" text="Create your first institution to start onboarding." />}
          {institutions.map((inst) => (
            <button
              className={selectedInstitution?.id === inst.id ? "table-row active" : "table-row"}
              key={inst.id}
              onClick={() => selectInstitution(inst)}
              type="button"
            >
              <div className="item-thumb bag">{inst.name?.[0]?.toUpperCase() || "I"}</div>
              <div className="row-main">
                <strong>{inst.name}</strong>
                <span>
                  {inst.memberCount} members - {inst.adminCount} admins
                </span>
              </div>
              <Badge text={inst.status} tone={inst.status === "INACTIVE" ? "warning" : "neutral"} />
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </div>

      <aside className="panel detail-panel">
        <PanelTitle
          icon={mode === "create" ? Plus : Building2}
          title={mode === "create" ? "Create institution" : selectedInstitution?.name || "Institution"}
          action={mode === "create" ? "New" : selectedInstitution?.id || ""}
        />

        {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

        <form className="institution-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Name</span>
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Delhi University" required />
          </label>

          <label className="form-field">
            <span>Slug (optional)</span>
            <input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="auto-generated from name" />
          </label>

          <label className="form-field">
            <span>Description</span>
            <textarea
              rows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Short description shown to members"
            />
          </label>

          <label className="form-field">
            <span>Member email domains</span>
            <textarea
              rows={2}
              value={form.emailDomainsText}
              onChange={(event) => setForm({ ...form, emailDomainsText: event.target.value })}
              placeholder="du.ac.in, du.edu"
            />
            <small>Comma or newline separated. Users with these email domains auto-join as members.</small>
            {emailDomainPreview.length > 0 && (
              <div className="tag-list inline-tags">
                {emailDomainPreview.map((domain) => (
                  <span key={domain}>
                    <Mail size={12} /> {domain}
                  </span>
                ))}
              </div>
            )}
          </label>

          <label className="form-field">
            <span>Admin emails</span>
            <textarea
              rows={2}
              value={form.adminEmailsText}
              onChange={(event) => setForm({ ...form, adminEmailsText: event.target.value })}
              placeholder="security@du.ac.in, lostandfound@du.ac.in"
            />
            <small>Comma or newline separated. These users get institution admin powers in the admin web.</small>
            {adminEmailPreview.length > 0 && (
              <div className="tag-list inline-tags">
                {adminEmailPreview.map((email) => (
                  <span key={email}>
                    <Shield size={12} /> {email}
                  </span>
                ))}
              </div>
            )}
          </label>

          {mode === "edit" && (
            <label className="form-field">
              <span>Status</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
          )}

          <div className="action-grid">
            <button type="submit" className="primary-button" disabled={loading || !form.name.trim()}>
              <Save size={16} /> {mode === "edit" ? "Save changes" : "Create institution"}
            </button>
            {mode === "edit" && selectedInstitution && (
              <button type="button" className="secondary-button" onClick={cancelEdit} disabled={loading}>
                <X size={16} /> Cancel
              </button>
            )}
          </div>
        </form>

        {mode === "edit" && selectedInstitution && (
          <>
            <div className="action-grid archive-row">
              {selectedInstitution.status === "ACTIVE" ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => archiveInstitution(selectedInstitution.id)}
                  disabled={loading}
                >
                  <Archive size={16} /> Archive
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => restoreInstitution(selectedInstitution.id)}
                  disabled={loading}
                >
                  <RotateCcw size={16} /> Restore
                </button>
              )}
            </div>

            <div className="detail-grid">
              <Info label="Status" value={selectedInstitution.status} />
              <Info label="Members" value={`${selectedInstitution.memberCount} users`} />
              <Info label="Admins" value={`${selectedInstitution.adminCount} users`} />
              <Info label="Created" value={selectedInstitution.createdAt} />
            </div>

            <PanelTitle icon={Users} title="Members" action={membersLoading ? "Loading" : `${members.length} users`} />
            <button type="button" className="secondary-button" onClick={() => loadMembers(selectedInstitution.id)} disabled={membersLoading}>
              <RefreshCw size={15} /> Refresh member list
            </button>
            <div className="user-grid">
              {members.length === 0 && !membersLoading && (
                <div className="empty-state">
                  <Users size={22} />
                  <strong>No members yet</strong>
                  <span>Users with matching email domains will appear here after they sign in.</span>
                </div>
              )}
              {members.map((member) => (
                <div className="user-row" key={member.id}>
                  <div className="avatar">{member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "U"}</div>
                  <div>
                    <strong>{member.name || "Unnamed user"}</strong>
                    <span>{member.email}</span>
                  </div>
                  {member.isAdmin ? <Badge text="ADMIN" tone="success" /> : <Badge text="MEMBER" />}
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </section>
  );
}

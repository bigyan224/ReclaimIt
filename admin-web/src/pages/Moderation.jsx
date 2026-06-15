import { Ban, Building2, Check, ChevronRight, Edit3, Eye, Filter, Flag, Search, Shield, Tag, Trash2 } from "lucide-react";
import React from "react";
import { Badge, EmptyState, Info, ItemThumb, PanelTitle } from "../components/ui.jsx";

export default function Moderation({ filteredItems, query, setQuery, statusFilter, setStatusFilter, selectedItem, setSelectedItem, setItemStatus, removeItem, quickEditItem, loading, userInfo }) {
  if (!userInfo?.isMasterAdmin && !userInfo?.isInstitutionAdmin) {
    return (
      <section className="page-grid">
        <div className="panel wide" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <Building2 size={48} color="#CBD5E1" />
          <h2 style={{ marginTop: 16, color: '#0F172A' }}>You are not an admin of any institution</h2>
          <p style={{ color: '#64748B', marginTop: 8 }}>Create an institution to start seeing items data.</p>
        </div>
      </section>
    );
  }
  return (
    <section className="split-layout">
      <div className="panel list-panel">
        <PanelTitle icon={Shield} title="Unified item queue" action={loading ? "Loading" : `${filteredItems.length} records`} />
        <div className="toolbar">
          <label className="search-field">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search item, owner, location" />
          </label>
          <label className="select-field">
            <Filter size={16} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {["All", "ACTIVE", "FLAGGED", "ARCHIVED", "CLAIMED"].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="data-table">
          {!loading && filteredItems.length === 0 && <EmptyState title="No items found" text="Try a different search or status filter." />}
          {filteredItems.map((item) => (
            <button className={selectedItem?.id === item.id ? "table-row active" : "table-row"} key={item.id} onClick={() => setSelectedItem(item)}>
              <ItemThumb kind={item.image} imageUrl={item.imageUrl} />
              <div className="row-main">
                <strong>{item.title}</strong>
                <span>{item.owner} - {item.location}</span>
              </div>
              <Badge text={item.type} />
              <Badge text={item.status} tone={item.status === "FLAGGED" ? "danger" : "neutral"} />
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </div>

      <aside className="panel detail-panel">
        {selectedItem ? (
          <>
            <PanelTitle icon={Eye} title="Moderation card" action={selectedItem.id} />
            <div className="item-preview">
              <ItemThumb kind={selectedItem.image} imageUrl={selectedItem.imageUrl} large />
              <div>
                <h2>{selectedItem.title}</h2>
                <p>{selectedItem.description}</p>
              </div>
            </div>

            <div className="detail-grid">
              <Info label="Owner" value={selectedItem.owner} />
              <Info label="Category" value={selectedItem.category} />
              <Info label="Location" value={selectedItem.location} />
              <Info label="Coordinates" value={selectedItem.coords} />
              <Info label="Risk" value={selectedItem.risk} />
              <Info label="Reported" value={selectedItem.age} />
            </div>
            <div className="tag-list">
              {selectedItem.tags.map((tag) => (
                <span key={tag}>
                  <Tag size={13} /> {tag}
                </span>
              ))}
            </div>
            <div className="action-grid">
              <button className="primary-button" onClick={() => setItemStatus(selectedItem.id, "ACTIVE")}>
                <Check size={16} /> Approve
              </button>
              <button className="secondary-button" onClick={() => setItemStatus(selectedItem.id, "FLAGGED")}>
                <Flag size={16} /> Flag
              </button>
              <button className="secondary-button" onClick={() => setItemStatus(selectedItem.id, "ARCHIVED")}>
                <Ban size={16} /> Block
              </button>
              <button className="danger-button" onClick={() => removeItem(selectedItem.id)}>
                <Trash2 size={16} /> Delete
              </button>
              <button className="secondary-button span-two" onClick={() => quickEditItem(selectedItem.id, { category: selectedItem.category, description: selectedItem.description })}>
                <Edit3 size={16} /> Quick edit category and tags
              </button>
            </div>
          </>
        ) : (
          <EmptyState title="No item selected" text="Choose an item from the moderation queue." />
        )}
      </aside>
    </section>
  );
}

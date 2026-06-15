import { Building2, Cloud, Settings, Sparkles, Tag, X } from "lucide-react";
import { categories } from "../data/mockData.js";
import { ConfigRange, PanelTitle } from "../components/ui.jsx";
import React, { useState } from "react";

export default function SettingsPanel({ config, setConfig, saveConfig, loading, userInfo }) {
  if (!userInfo?.isMasterAdmin && !userInfo?.isInstitutionAdmin) {
    return (
      <section className="page-grid">
        <div className="panel wide" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <Building2 size={48} color="#CBD5E1" />
          <h2 style={{ marginTop: 16, color: '#0F172A' }}>You are not an admin of any institution</h2>
          <p style={{ color: '#64748B', marginTop: 8 }}>Create an institution to access settings.</p>
        </div>
      </section>
    );
  }
  const weights = config.weights || {};
  const setMinimumScore = (value) => setConfig((current) => ({ ...current, minimumScore: value }));
  const setWeight = (key, value) => {
    setConfig((current) => ({
      ...current,
      weights: {
        ...(current.weights || {}),
        [key]: value,
      },
    }));
  };

  return (
    <section className="page-grid">
      <div className="panel wide">
        <PanelTitle icon={Settings} title="Category manager" action={`${categories.length} active`} />
        <div className="category-grid">
          {categories.map((category) => (
            <div className="category-chip" key={category}>
              <Tag size={15} />
              <span>{category}</span>
              <button aria-label={`Hide ${category}`}>
                <X size={14} />
              </button>
            </div>
          ))}
          <button className="add-chip">Add category</button>
        </div>
      </div>
      <div className="panel">
        <PanelTitle icon={Sparkles} title="AI configuration" action={loading ? "Saving" : "Live"} />
        <ConfigRange label="Minimum score" value={config.minimumScore || 0} setValue={setMinimumScore} />
        <ConfigRange label="Location weight" value={weights.location || 0} setValue={(value) => setWeight("location", value)} />
        <ConfigRange label="Title weight" value={weights.title || 0} setValue={(value) => setWeight("title", value)} />
        <ConfigRange label="Brand weight" value={weights.brand || 0} setValue={(value) => setWeight("brand", value)} />
        <ConfigRange label="Color weight" value={weights.color || 0} setValue={(value) => setWeight("color", value)} />
        <button className="primary-button" onClick={() => saveConfig(config)}>Save AI config</button>
      </div>
      <div className="panel">
        <PanelTitle icon={Cloud} title="Storage policy" action="Cloudinary" />
        <div className="toggle-list">
          <Toggle checked label="Auto-delete temp images after 24h" />
          <Toggle checked label="Block uploads from banned users" />
          <Toggle label="Require manual review for ID images" />
        </div>
      </div>
    </section>
  );
}

function Toggle({ label, checked = false }) {
  const [enabled, setEnabled] = useState(checked);

  return (
    <button className="toggle-row" onClick={() => setEnabled((value) => !value)}>
      <span>{label}</span>
      <i className={enabled ? "on" : ""}>
        <b />
      </i>
    </button>
  );
}

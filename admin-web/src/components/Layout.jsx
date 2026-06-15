import { Activity, Bell, Lock } from "lucide-react";
import React from "react";
import { UserButton, useUser } from "@clerk/clerk-react";
import { navItems } from "../data/mockData.js";
import { apiBase } from "../services/adminApi.js";

export default function Layout({ activeTab, setActiveTab, children }) {
  const { user } = useUser();
  const activeLabel = navItems.find((item) => item.id === activeTab)?.label;
  const initials = user?.firstName?.[0] || user?.primaryEmailAddress?.emailAddress?.[0] || "A";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/reclaimit-logo.png" alt="ReclaimIt" />
          <div>
            <strong>ReclaimIt</strong>
            <span>Admin Portal</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Admin modules">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button className={activeTab === item.id ? "nav-item active" : "nav-item"} key={item.id} onClick={() => setActiveTab(item.id)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="security-card">
          <Lock size={18} />
          <div>
            <strong>Admin session</strong>
            <span>Clerk role + MFA ready</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">Connected target</span>
            <h1>{activeLabel}</h1>
          </div>
          <div className="top-actions">
            <div className="api-pill">
              <Activity size={16} />
              <span>{apiBase}/admin</span>
            </div>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <div className="admin-user">
              <span>{initials.toUpperCase()}</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

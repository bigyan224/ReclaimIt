import { Activity, AlertTriangle, Building2, Cpu, Gauge } from "lucide-react";
import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { stats as fallbackStats, usageData } from "../data/mockData.js";
import { AlertRow, PanelTitle } from "../components/ui.jsx";

export default function Dashboard({ dashboard, loading, userInfo }) {
  if (!userInfo?.isMasterAdmin && !userInfo?.isInstitutionAdmin) {
    return (
      <section className="page-grid">
        <div className="panel wide" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <Building2 size={48} color="#CBD5E1" />
          <h2 style={{ marginTop: 16, color: '#0F172A' }}>You are not an admin of any institution</h2>
          <p style={{ color: '#64748B', marginTop: 8 }}>Create an institution to start seeing dashboard data.</p>
        </div>
      </section>
    );
  }
  const analytics = dashboard.analytics.length > 0 ? dashboard.analytics : [{ day: "Now", lost: 0, found: 0, returned: 0 }];
  const stats = buildStats(dashboard.stats);
  const health = dashboard.health || {};

  return (
    <section className="page-grid">
      {loading && <div className="status-line wide">Loading dashboard metrics...</div>}
      <div className="metrics-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className={`metric-card ${stat.tone}`} key={stat.label}>
              <div className="metric-icon">
                <Icon size={20} />
              </div>
              <span>{stat.label}</span>
              <strong>{stat.value.toLocaleString()}</strong>
              <small>{stat.delta}</small>
            </article>
          );
        })}
      </div>

      <div className="panel wide">
        <PanelTitle icon={Activity} title="Lost vs found report volume" action="Last 7 days" />
        <div className="chart-height">
          <ResponsiveContainer>
            <AreaChart data={analytics}>
              <defs>
                <linearGradient id="lost" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="found" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#0f766e" stopOpacity={0.24} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Area dataKey="lost" stroke="#2563eb" fill="url(#lost)" strokeWidth={3} />
              <Area dataKey="found" stroke="#0f766e" fill="url(#found)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel">
        <PanelTitle icon={Cpu} title="Usage monitors" action="Live" />
        <div className="usage-list">
          {usageData.map((entry) => (
            <div className="usage-row" key={entry.name}>
              <div>
                <strong>{entry.name}</strong>
                <span>{entry.value}% capacity</span>
              </div>
              <div className="progress">
                <i style={{ width: `${entry.value}%`, background: entry.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <PanelTitle icon={AlertTriangle} title="Health alerts" action="Live checks" />
        <div className="alert-list">
          <AlertRow tone={health.database === "connected" ? "success" : "warning"} title="Database" text={health.database || "Unknown"} />
          <AlertRow tone={health.cloudinaryConfigured ? "success" : "warning"} title="Cloudinary" text={health.cloudinaryConfigured ? "Configured" : "Missing credentials"} />
          <AlertRow tone={health.geminiConfigured ? "success" : "info"} title="Gemini" text={health.geminiConfigured ? "Configured" : "Using fallback matching"} />
        </div>
      </div>

      <div className="panel wide">
        <PanelTitle icon={Gauge} title="Return efficiency" action="Weekly" />
        <div className="chart-height short">
          <ResponsiveContainer>
            <BarChart data={analytics}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="returned" radius={[6, 6, 0, 0]} fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function buildStats(liveStats) {
  if (!liveStats) return fallbackStats;

  return [
    { ...fallbackStats[0], value: liveStats.activeLost || 0, delta: "Live count" },
    { ...fallbackStats[1], value: liveStats.activeFound || 0, delta: "Live count" },
    { ...fallbackStats[2], value: liveStats.successfulMatches || 0, delta: "Accepted matches" },
    { ...fallbackStats[3], value: liveStats.unresolvedDisputes || 0, delta: `${liveStats.flaggedItems || 0} flagged items` },
  ];
}

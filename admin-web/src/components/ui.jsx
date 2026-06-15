import { MoreHorizontal } from "lucide-react";
import React from "react";
import { Cell, Pie, PieChart } from "recharts";

export function PanelTitle({ icon: Icon, title, action }) {
  return (
    <div className="panel-title">
      <div>
        <Icon size={18} />
        <h2>{title}</h2>
      </div>
      <span>{action}</span>
    </div>
  );
}

export function AlertRow({ tone, title, text }) {
  return (
    <div className={`alert-row ${tone}`}>
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

export function Badge({ text, tone = "neutral" }) {
  return <span className={`badge ${tone}`}>{text}</span>;
}

export function Info({ label, value }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ItemThumb({ kind, imageUrl = null, large = false }) {
  if (imageUrl) {
    return (
      <div 
        className={`item-thumb ${large ? "large" : ""}`} 
        style={{ 
          backgroundImage: `url(${imageUrl})`, 
          backgroundSize: "cover", 
          backgroundPosition: "center",
          border: "none"
        }} 
      />
    );
  }
  return (
    <div className={`item-thumb ${kind} ${large ? "large" : ""}`}>
      {kind === "phone" && "S24"}
      {kind === "wallet" && "ID"}
      {kind === "bag" && "BP"}
      {kind === "ring" && "Au"}
    </div>
  );
}

export function Dial({ label, value }) {
  const data = [{ value }, { value: 100 - value }];

  return (
    <div className="dial">
      <PieChart width={62} height={62}>
        <Pie data={data} innerRadius={21} outerRadius={29} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
          <Cell fill="#2563eb" />
          <Cell fill="#e5e7eb" />
        </Pie>
      </PieChart>
      <strong>{value}%</strong>
      <span>{label}</span>
    </div>
  );
}

export function ConfigRange({ label, value, setValue }) {
  return (
    <label className="config-range">
      <span>
        {label}
        <strong>{value}%</strong>
      </span>
      <input type="range" min="0" max="100" value={value} onChange={(event) => setValue(Number(event.target.value))} />
    </label>
  );
}

export function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <MoreHorizontal size={24} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

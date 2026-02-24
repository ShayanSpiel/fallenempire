import React from "react";
import { cn } from "@/lib/utils";

// Custom MDX components that integrate with your design system

export function Callout({
  children,
  type = "info",
}: {
  children: React.ReactNode;
  type?: "info" | "warning" | "success" | "danger";
}) {
  const styles = {
    info: "border-primary/30 bg-primary/5 text-foreground",
    warning: "border-warning/30 bg-warning/5 text-foreground",
    success: "border-success/30 bg-success/5 text-foreground",
    danger: "border-destructive/30 bg-destructive/5 text-foreground",
  };

  const icons = {
    info: "ℹ️",
    warning: "⚠️",
    success: "✅",
    danger: "🚨",
  };

  return (
    <div
      className={cn(
        "my-6 rounded-lg border-2 p-4",
        styles[type]
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icons[type]}</span>
        <div className="flex-1 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function StatBlock({
  title,
  stats,
}: {
  title: string;
  stats: Array<{ label: string; value: string | number }>;
}) {
  return (
    <div className="my-6 rounded-lg border border-border bg-card p-4">
      <h4 className="mb-3 text-lg font-bold text-card-foreground">{title}</h4>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="flex flex-col">
            <span className="text-xs text-muted-foreground">{stat.label}</span>
            <span className="text-xl font-bold text-primary">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: string;
}) {
  return (
    <div className="group rounded-lg border border-border bg-card p-5 transition-all hover:border-primary hover:shadow-lg">
      {icon && <div className="mb-3 text-3xl">{icon}</div>}
      <h3 className="mb-2 text-lg font-bold text-card-foreground group-hover:text-primary transition-colors">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function Tabs({
  items,
}: {
  items: Array<{ label: string; content: React.ReactNode }>;
}) {
  const [activeTab, setActiveTab] = React.useState(0);

  return (
    <div className="my-6">
      <div className="flex gap-2 border-b border-border mb-4">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative",
              activeTab === i
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {activeTab === i && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        {items[activeTab]?.content}
      </div>
    </div>
  );
}

export function ComparisonTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | React.ReactNode>>;
}) {
  return (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-border">
            {headers.map((header, i) => (
              <th
                key={i}
                className="p-3 text-left text-sm font-bold text-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border hover:bg-muted/30 transition-colors"
            >
              {row.map((cell, j) => (
                <td key={j} className="p-3 text-sm text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProgressBar({
  label,
  value,
  max = 100,
  color = "primary",
}: {
  label: string;
  value: number;
  max?: number;
  color?: "primary" | "success" | "warning" | "destructive";
}) {
  const percentage = (value / max) * 100;
  const colors = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  };

  return (
    <div className="my-4">
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", colors[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const styles = {
    default: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    danger: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold",
        styles[variant]
      )}
    >
      {children}
    </span>
  );
}

export function Steps({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="my-6 space-y-4 [counter-reset:step]">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === Step) {
          return child;
        }
        return null;
      })}
    </div>
  );
}

export function Step({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 [counter-increment:step]">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground before:content-[counter(step)]" />
      <div className="flex-1 pb-4">
        <h4 className="mb-2 font-bold text-foreground">{title}</h4>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

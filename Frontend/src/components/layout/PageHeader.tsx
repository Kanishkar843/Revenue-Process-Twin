import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-[var(--color-border)] px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-ink)] font-display tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
    </div>
  );
}

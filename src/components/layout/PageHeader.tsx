"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 sm:mt-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center sm:p-14">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-3xl">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-foreground sm:text-lg">{title}</h3>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  hover = false,
  style,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6",
        hover && "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  className,
  type = "button",
  title,
}: {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  title?: string;
}) {
  const variants = {
    primary:
      "bg-primary text-primary-foreground shadow-sm hover:opacity-90 focus:ring-primary/30",
    secondary:
      "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary/30",
    ghost:
      "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus:ring-muted",
    danger:
      "bg-graveyard text-white shadow-sm hover:opacity-90 focus:ring-graveyard/30",
    outline:
      "border border-border bg-transparent text-foreground hover:bg-muted focus:ring-muted",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-[11px] gap-1",
    md: "px-4 py-2 text-xs gap-1.5",
    lg: "px-5 py-2.5 text-sm gap-1.5",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}

export function Skeleton({
  className,
  count = 1,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse rounded-xl bg-muted/70",
            className
          )}
        />
      ))}
    </>
  );
}

export function LoadingState({ title }: { title: string }) {
  return (
    <div className="p-4 sm:p-8">
      <PageHeader title={title} subtitle="加载中..." />
      <div className="space-y-5">
        <Skeleton className="h-36 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}

export function Badge({
  children,
  color = "default",
  className,
}: {
  children: React.ReactNode;
  color?: "northstar" | "campaign" | "task" | "graveyard" | "cognition" | "default";
  className?: string;
}) {
  const colorMap = {
    northstar: "bg-northstar/10 text-northstar border-northstar/20",
    campaign: "bg-campaign/10 text-campaign border-campaign/20",
    task: "bg-task/10 text-task border-task/20",
    graveyard: "bg-graveyard/10 text-graveyard border-graveyard/20",
    cognition: "bg-cognition/10 text-cognition border-cognition/20",
    default: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        colorMap[color],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Surface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

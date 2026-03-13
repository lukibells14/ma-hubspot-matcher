import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type ButtonVariant = "primary" | "outline" | "ghost";

export function Button({ variant = "outline", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variantClass = variant === "primary" ? "ds-btn-primary" : variant === "ghost" ? "ds-btn-ghost" : "";
  return <button className={`ds-btn ${variantClass} ${className}`.trim()} {...props} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`ds-card ${className}`.trim()}>{children}</div>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="ds-input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="ds-input" {...props} />;
}

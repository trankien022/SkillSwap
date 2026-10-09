import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export default function InfoCard({ title, subtitle, children, className = "" }: Props) {
  return (
    <div className={`p-space-md rounded-lg bg-surface-container-low ${className}`}>
      <div>{title}</div>
      {subtitle ? <div className="text-caption text-on-surface-variant">{subtitle}</div> : null}
      {children}
    </div>
  );
}
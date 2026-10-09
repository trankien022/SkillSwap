type Props = {
  status: string;
};

export default function StatusBadge({ status }: Props) {
  const map: Record<string, { label: string; className: string }> = {
    verified: { label: "Đã xác thực", className: "px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-caption font-semibold" },
    pending: { label: "Đang xét", className: "px-2 py-0.5 rounded-full bg-surface-container text-tertiary text-tertiary font-semibold" },
    default: { label: status, className: "px-2 py-0.5 rounded-full bg-surface-container text-primary text-caption font-semibold" },
  };

  const resolved = map[status] ?? map.default;

  return <span className={resolved.className}>{resolved.label}</span>;
}
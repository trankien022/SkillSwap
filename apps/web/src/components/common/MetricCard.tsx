type Props = {
  label: string;
  value: string | number;
  icon?: string;
};

export default function MetricCard({ label, value, icon }: Props) {
  return (
    <div className="p-space-sm px-space-md rounded-lg bg-surface-container-low flex items-center justify-between">
      <div className="flex items-center gap-space-xs">
        {icon ? <span className="material-symbols-outlined text-[18px]">{icon}</span> : null}
        <span className="text-body-sm text-on-surface">{label}</span>
      </div>
      <span className="text-label-md font-bold text-on-surface">{value}</span>
    </div>
  );
}
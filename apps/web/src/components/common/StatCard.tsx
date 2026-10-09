export default function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="p-4 bg-white rounded-md shadow">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-medium text-slate-900">{value}</div>
    </div>
  );
}

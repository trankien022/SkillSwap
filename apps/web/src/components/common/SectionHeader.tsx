export default function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      {subtitle ? (
        <p className="text-sm text-slate-600 mt-1">{subtitle}</p>
      ) : null}
    </div>
  );
}

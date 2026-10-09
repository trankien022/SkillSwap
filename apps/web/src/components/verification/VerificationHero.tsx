
type Props = {
  title?: string;
  subtitle?: string;
  badge?: string;
};

export default function VerificationHero({ title = "Trung tâm Thẩm định & Xác minh", subtitle, badge }: Props) {
  return (
    <div className="mb-space-xl flex flex-col md:flex-row md:items-end justify-between gap-space-md pb-space-lg border-b border-surface-variant/50">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed/50 text-secondary font-label-sm">
          <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified
          </span>
          <span>{badge ?? "Hồ sơ đã kiểm duyệt chính thức"}</span>
        </div>
        <h1 className="text-headline-lg font-bold text-primary tracking-tight mt-2">{title}</h1>
        {subtitle ? <p className="text-body-md text-on-surface-variant max-w-2xl">{subtitle}</p> : null}
      </div>
    </div>
  );
}
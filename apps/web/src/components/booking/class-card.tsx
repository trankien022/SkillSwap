export interface ClassCardCopy {
  startsAt: string;
  duration: string;
  capacity: string;
  price: string;
  durationLabel: string;
  seatsLabel: string;
}

/** Presentational class summary card (DESIGN.md: white card on mist, 16px radius). */
export function ClassCard({ copy }: { copy: ClassCardCopy }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{copy.startsAt}</h2>
      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-slate-600">
        <div className="flex gap-2">
          <dt>{copy.durationLabel}</dt>
          <dd className="font-medium text-slate-900">{copy.duration}</dd>
        </div>
        <div className="flex gap-2">
          <dt>{copy.seatsLabel}</dt>
          <dd className="font-medium text-slate-900">{copy.capacity}</dd>
        </div>
      </dl>
      <p className="mt-4 text-2xl font-semibold tabular-nums text-slate-900">{copy.price}</p>
    </article>
  );
}

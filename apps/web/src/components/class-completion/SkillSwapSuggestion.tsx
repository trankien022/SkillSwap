import type { SuggestionItem } from "../../types/class-completion";

export default function SkillSwapSuggestion({ items }: { items: SuggestionItem[] }) {
  return (
    <div className="p-4 bg-white rounded-md shadow">
      <div className="text-sm text-slate-500">Gợi ý SkillSwap</div>
      <ul className="mt-2 space-y-2">
        {items.map((it) => (
          <li key={it.id} className="p-2 rounded bg-slate-50">
            <div className="font-medium">{it.title}</div>
            {it.description ? <div className="text-sm text-slate-500">{it.description}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

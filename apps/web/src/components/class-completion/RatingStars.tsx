"use client";
import { useState } from "react";

export default function RatingStars({ value = 0, onChange }: { value?: number; onChange?: (n: number) => void }) {
  const [v, setV] = useState<number>(value);
  function setRating(n: number) {
    setV(n);
    onChange?.(n);
  }
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => setRating(n)}
          className={`px-2 py-1 rounded ${n <= v ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-600'}`}
          aria-label={`Rate ${n}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

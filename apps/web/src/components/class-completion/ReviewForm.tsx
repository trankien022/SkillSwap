"use client";
import { useState } from "react";
import RatingStars from "./RatingStars";
import SuccessToast from "./SuccessToast";

export default function ReviewForm({ defaultRating = 0 }: { defaultRating?: number }) {
  const [rating, setRating] = useState<number>(defaultRating);
  const [text, setText] = useState<string>("");
  const [success, setSuccess] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // mock submit
    setTimeout(() => setSuccess(true), 300);
  }

  return (
    <div>
      <form onSubmit={submit} className="p-4 bg-white rounded-md shadow space-y-3">
        <div>
          <label className="text-sm text-slate-600">Đánh giá</label>
          <div className="mt-2">
            <RatingStars value={rating} onChange={setRating} />
          </div>
        </div>
        <div>
          <label className="text-sm text-slate-600">Bình luận</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full mt-2 p-2 border rounded" rows={4} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded">Gửi</button>
          <button type="button" onClick={() => { setText(""); setRating(0); }} className="px-3 py-2 border rounded">Hủy</button>
        </div>
      </form>
      {success ? <SuccessToast message="Cảm ơn! Đánh giá đã gửi." onClose={() => setSuccess(false)} /> : null}
    </div>
  );
}

"use client";
import { useEffect } from "react";

export default function SuccessToast({ message = "Hoàn tất", onClose }: { message?: string; onClose?: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => onClose?.(), 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-4 py-2 rounded shadow">{message}</div>
  );
}

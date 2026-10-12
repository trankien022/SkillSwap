import { useState } from "react";
import type { StudentIdentity } from "../../types/verification";

type Props = {
  scannedImageUrl?: string;
  student: StudentIdentity;
};

export default function StudentCardPreview({ scannedImageUrl, student }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden bg-surface-container-high h-56 sm:h-64 border border-surface-variant/40">
        {scannedImageUrl ? (
          // blurred, dimmed background like original stitch
          <img
            alt="Thẻ sinh viên đã xác thực"
            className="w-full h-full object-cover filter blur-[2px] opacity-80"
            src={scannedImageUrl}
          />
        ) : (
          <div className="w-full h-full bg-surface-container-high flex items-center justify-center">No image</div>
        )}

        <div className="absolute inset-0 bg-primary/20 flex flex-col justify-between p-space-md pointer-events-none">
          <div className="flex justify-between items-center">
            <span className="px-2.5 py-1 rounded-full bg-secondary text-on-secondary text-caption font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              Bảo mật nội bộ
            </span>
            <span className="text-surface-bright text-caption font-mono bg-on-surface/75 px-2.5 py-1 rounded backdrop-blur-sm">
              MSSV: {student.studentId}
            </span>
          </div>

          <div className="text-center">
            <span className="text-surface-bright/50 font-display-lg font-bold tracking-widest text-[28px] uppercase select-none">
              SKILLSWAP VERIFIED
            </span>
          </div>

          <div className="flex justify-between items-center text-caption text-surface-bright/90 bg-on-surface/75 px-3 py-1.5 rounded backdrop-blur-sm">
            <span>{student.school}</span>
            <span>Xác thực: {student.verifiedAt}</span>
          </div>
        </div>

        {/* View button (enabled) */}
        {scannedImageUrl && (
          <div className="absolute top-3 right-3 pointer-events-none">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="pointer-events-auto inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/90 text-emerald-700 shadow-md hover:bg-white"
              aria-label="Xem thẻ"
            >
              <span className="material-symbols-outlined text-[18px]">visibility</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl max-w-3xl w-full mx-4 overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b">
              <h3 className="text-lg font-semibold">Thẻ sinh viên</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setOpen(false)} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4">
              {scannedImageUrl ? (
                <img src={scannedImageUrl} alt="Thẻ sinh viên" className="w-full h-auto rounded-md object-contain" />
              ) : (
                <div className="w-full h-64 flex items-center justify-center text-gray-500">No image available</div>
              )}
            </div>
            <div className="p-4 text-right">
              <button className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setOpen(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
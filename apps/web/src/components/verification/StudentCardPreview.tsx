import type { StudentIdentity } from "../../types/verification";

type Props = {
  scannedImageUrl?: string;
  student: StudentIdentity;
};

export default function StudentCardPreview({ scannedImageUrl, student }: Props) {
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
      </div>
    </div>
  );
}
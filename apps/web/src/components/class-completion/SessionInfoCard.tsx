import type { SessionInfo, TeacherInfo } from "../../types/class-completion";

export default function SessionInfoCard({
  session,
  teacher,
}: {
  session: SessionInfo | null;
  teacher: TeacherInfo | null;
}) {
  if (!session) return null;
  return (
    <div className="p-4 bg-white rounded-md shadow">
      <div className="text-sm text-slate-500">Buổi học</div>
      <div className="mt-1">
        <div className="text-lg font-semibold">{session.title}</div>
        <div className="text-sm text-slate-600 mt-1">{session.date} • {session.durationMinutes} phút</div>
        {session.location ? <div className="text-sm text-slate-600">{session.location}</div> : null}
      </div>
      {teacher ? (
        <div className="mt-4 border-t pt-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            {teacher.name.charAt(0)}
          </div>
          <div>
            <div className="font-medium">{teacher.name}</div>
            {teacher.rating ? <div className="text-sm text-slate-500">{teacher.rating} / 5</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

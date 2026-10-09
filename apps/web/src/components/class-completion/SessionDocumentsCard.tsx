import type { DocumentItem } from "../../types/class-completion";

export default function SessionDocumentsCard({ documents }: { documents: DocumentItem[] }) {
  return (
    <div className="p-4 bg-white rounded-md shadow">
      <div className="text-sm text-slate-500">Tài liệu</div>
      <ul className="mt-2 space-y-2">
        {documents.map((d) => (
          <li key={d.id} className="flex items-center justify-between">
            <div className="text-sm">{d.name}</div>
            <div>
              <button className="text-sm px-2 py-1 border rounded">Tải</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

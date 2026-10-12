import { useState } from "react";
import type { Certificate } from "../../types/verification";
import CertificateItem from "../common/CertificateItem";

type Props = {
  certificates: Certificate[];
};

export default function CertificateSection({ certificates }: Props) {
  // keep a local copy for mock add behavior
  const [items, setItems] = useState<Certificate[]>(() => certificates || []);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [selected, setSelected] = useState<Certificate | null>(null);

  // fields for new cert
  const [useLink, setUseLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);

  const pending = items.filter((c) => c.status === "pending").length;
  const approved = items.filter((c) => c.status === "approved").length;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return setFileDataUrl(null);
    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUrl(String(reader.result || null));
      // when user picks a file, prefer file over link
      setUseLink(false);
      setLinkUrl("");
    };
    reader.readAsDataURL(f);
  }

  function addCertificate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return alert("Vui lòng nhập tiêu đề chứng chỉ");
    if (useLink && !linkUrl.trim()) return alert("Vui lòng nhập link chứng chỉ hoặc tắt chọn link");

    const newCert: Certificate = {
      id: `local-${Date.now()}`,
      title: title.trim(),
      issuer: issuer.trim() || "Người dùng",
      status: "pending",
      imageUrl: fileDataUrl || undefined,
      linkUrl: useLink ? linkUrl.trim() : undefined,
    } as Certificate;
    setItems((s) => [newCert, ...s]);
    setTitle("");
    setIssuer("");
    setUseLink(false);
    setLinkUrl("");
    setFileDataUrl(null);
    setShowAdd(false);
  }

  return (
    <div className="h-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-lg">{approved}</div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Chứng chỉ chuyên môn</h3>
            <p className="text-xs text-gray-500">Bằng chứng năng lực do sinh viên cung cấp</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500 font-semibold text-right">{items.length} mục • {approved} Đã duyệt • {pending} Đang xét</div>
          <button type="button" onClick={() => setShowAdd(true)} className="ml-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition">
            <span className="material-symbols-outlined">add</span>
            <span>Thêm chứng chỉ</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((cert) => (
          <div key={cert.id} className="bg-white rounded-lg p-3 border border-gray-100 overflow-hidden">
            <div className="w-full grid grid-cols-[1fr_96px_96px] items-center gap-3">
              <div className="min-w-0">
                <CertificateItem certificate={cert} onView={(c) => setSelected(c)} />
              </div>

              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setSelected(cert)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white border border-gray-100 text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap max-w-full overflow-hidden"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  <span className="truncate">Xem ảnh</span>
                </button>
              </div>

              <div className="flex items-center justify-center">
                {cert.status === "approved" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold whitespace-nowrap max-w-full overflow-hidden">
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    <span className="truncate">Đã duyệt</span>
                  </span>
                ) : cert.status === "pending" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold whitespace-nowrap max-w-full overflow-hidden"><span className="truncate">Chờ duyệt</span></span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold whitespace-nowrap max-w-full overflow-hidden"><span className="truncate">Từ chối</span></span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto text-xs text-gray-500 text-center">Các chứng chỉ được xác thực tự động hoặc qua đối tác khi có.</div>

      {/* Certificate view modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-2xl shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">{selected.title}</h3>
                <div className="text-sm text-gray-500">{selected.issuer}</div>
              </div>
              <button className="text-gray-500" onClick={() => setSelected(null)} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-6">
              <div className="w-full border border-gray-100 rounded-xl py-10 flex items-center justify-center bg-gradient-to-b from-emerald-50 to-white">
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-emerald-700 mb-2">{selected.title}</div>
                  <div className="text-sm text-gray-600">{selected.issuer}</div>
                  <div className="mt-4 text-xs text-gray-500">(Ảnh bằng cấp mô phỏng)</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Add certificate modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h4 className="text-lg font-semibold">Thêm chứng chỉ</h4>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => { setShowAdd(false); setFileDataUrl(null); setUseLink(false); setLinkUrl(""); }} aria-label="close"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form className="p-4 space-y-3" onSubmit={addCertificate}>
              <div>
                <label className="block text-xs text-gray-600">Tiêu đề</label>
                <input className="w-full mt-1 p-2 border rounded-md" value={title} onChange={(e)=>setTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-600">Đơn vị cấp</label>
                <input className="w-full mt-1 p-2 border rounded-md" value={issuer} onChange={(e)=>setIssuer(e.target.value)} />
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useLink} onChange={(e)=>setUseLink(e.target.checked)} />
                  <span className="text-xs text-gray-600">Đây là chứng chỉ trực tuyến (link)</span>
                </label>
              </div>

              {!useLink && (
                <div>
                  <label className="block text-xs text-gray-600">Tải ảnh bằng cấp (jpg/png)</label>
                  <input type="file" accept="image/*" onChange={handleFile} className="w-full mt-1" />
                  {fileDataUrl && <img src={fileDataUrl} alt="preview" className="mt-2 max-h-40 object-contain" />}
                </div>
              )}

              {useLink && (
                <div>
                  <label className="block text-xs text-gray-600">Link chứng chỉ trực tuyến</label>
                  <input className="w-full mt-1 p-2 border rounded-md" value={linkUrl} onChange={(e)=>setLinkUrl(e.target.value)} placeholder="https://" />
                </div>
              )}

              <div className="text-right">
                <button type="button" className="mr-2 px-4 py-2 rounded-md" onClick={() => { setShowAdd(false); setFileDataUrl(null); setUseLink(false); setLinkUrl(""); }}>Huỷ</button>
                <button type="submit" className="px-4 py-2 rounded-md bg-emerald-600 text-white">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
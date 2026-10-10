"use client";
import { useEffect, useState } from "react";

type Doc = { id: string; name: string; href: string; size?: string; note?: string };

export default function Page() {
  const [rating, setRating] = useState<number>(5);
  const [criteria, setCriteria] = useState<Record<string, number>>({
    "1. Chuyên môn & Phương pháp": 5,
    "2. Tính đúng giờ & Tác phong": 5,
    "3. Tương tác & Sửa lỗi trực tiếp": 5,
    "4. Hạ tầng kết nối video Jitsi": 5,
  });
  const [comment, setComment] = useState<string>(
    'Bạn Lan Anh hướng dẫn rất tận tâm, chỉnh ngay các lỗi phát âm trọng âm và giúp mình triển khai ý tưởng Part 3 theo mô hình PEEL rất mạch lạc. Rất khuyến khích các bạn sinh viên luyện nói cùng bạn!'
  );
  const [toastVisible, setToastVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skillSwap, setSkillSwap] = useState({ python: true, saveContact: false });

  const docs: Doc[] = [
    { id: 'd1', name: 'Speaking_Critique_SS8821.pdf', href: '#', size: '2.4 MB', note: 'Nhận xét ngữ pháp & từ vựng' },
    { id: 'd2', name: 'Audio_Sample_Intonation.mp3', href: '#', size: '5.1 MB', note: 'Ghi âm mẫu ngữ điệu Part 3' },
  ];

  const starTexts: Record<number, string> = {
    1: "Chưa hài lòng (1.0 / 5.0) - Cần cải thiện",
    2: "Tạm ổn (2.0 / 5.0) - Cần lưu ý một số điểm",
    3: "Tốt (3.0 / 5.0) - Đạt chuẩn kỳ vọng",
    4: "Rất tốt (4.0 / 5.0) - Hài lòng",
    5: "Xuất sắc (5.0 / 5.0) - Cực kỳ khuyến nghị",
  };

  useEffect(() => {
    // ensure initial filled stars use font-variation
  }, []);

    const [apiModules, setApiModules] = useState<string[] | null>(null);
    const [moduleStatuses, setModuleStatuses] = useState<Record<string, { ok: boolean; detail?: any; error?: string }>>({});
    const [apiProbeError, setApiProbeError] = useState<string | null>(null);

    // Probe API health and each module's /status endpoint so the user can decide whether
    // to wire additional endpoints into the UI. This does not modify any backend.
    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          const { fetchApiHealth, DEFAULT_API_BASE } = await import("../../../lib/status");
          const health = await fetchApiHealth();
          if (!mounted) return;
          setApiModules(health.modules || []);

          const statuses: Record<string, { ok: boolean; detail?: any; error?: string }> = {};
          await Promise.all(
            (health.modules || []).map(async (m) => {
              try {
                const detail = await fetch(`${DEFAULT_API_BASE}/api/${m}/status`);
                if (!mounted) return;
                if (detail.ok) {
                  const json = await detail.json();
                  statuses[m] = { ok: true, detail: json };
                } else {
                  statuses[m] = { ok: false, error: `HTTP ${detail.status}` };
                }
              } catch (err: any) {
                statuses[m] = { ok: false, error: err?.message || String(err) };
              }
            }),
          );
          if (mounted) setModuleStatuses(statuses);
        } catch (err: any) {
          if (mounted) setApiProbeError(err?.message || String(err));
        }
      })();
      return () => {
        mounted = false;
      };
    }, []);

    function addChipText(text: string) {
      if (!comment.includes(text)) setComment((s) => (s ? s + '. ' + text : text));
    }

    function toggleSkillSwap(key: 'python' | 'saveContact') {
      setSkillSwap((s) => ({ ...s, [key]: !s[key] }));
    }

    function submitReview(e?: React.FormEvent) {
      e?.preventDefault();
      setSubmitting(true);
      setTimeout(() => {
        setToastVisible(true);
        setSubmitting(false);
      }, 700);
    }

    return (
      <main className="w-full py-8 bg-[#f8f9ff]">
      <div className="flex flex-col w-full">
        <div className="max-w-7xl mx-auto w-full px-6 space-y-6">
          {/* Milestone Progress Line */}
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium pb-2">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold">
              <span className="material-symbols-outlined text-[18px]">videocam_off</span>
              <span>1. Rời phòng Jitsi Meet</span>
            </div>
            <div className="h-0.5 flex-1 mx-4 bg-emerald-200" />
            <div className="flex items-center gap-2 text-blue-600 font-bold">
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>2. Nghiệm thu &amp; Giải ngân Escrow</span>
            </div>
            <div className="h-0.5 flex-1 mx-4 bg-gray-200" />
            <div className="flex items-center gap-2 text-gray-400">
              <span className="material-symbols-outlined text-[18px]">grade</span>
              <span>3. Đánh giá tín nhiệm Peer</span>
            </div>
          </div>

          {/* Celebration Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 to-blue-600 text-white p-6 shadow-md">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-xs font-semibold">
                  <span className="material-symbols-outlined text-[15px]">task_alt</span>
                  <span>Buổi học trực tuyến hoàn thành</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white">Buổi học đã hoàn thành thành công!</h1>
                <p className="text-sm text-blue-100">Phiên học trực tuyến 60 phút qua Jitsi Meet đã được ghi nhận an toàn.</p>
              </div>
              <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-2 shrink-0">
                <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                  <span className="text-[11px] text-blue-200 font-medium">MÃ BUỔI HỌC:</span>
                  <span className="text-sm font-bold tracking-wider text-white">#SS-VN-8821</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-blue-200">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  <span>Thời lượng: 60 phút (Trọn vẹn)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Grid */}
          {/* API discovery panel: lists modules returned by /api/health and probes each /api/{module}/status */}
          <div className="max-w-7xl mx-auto w-full px-6">
            {apiModules === null ? (
              <div className="rounded-xl bg-white p-3 border border-gray-100 text-sm text-gray-600">Checking API modules…</div>
            ) : (
              <div className="rounded-2xl bg-white p-4 border border-gray-100 space-y-2">
                <div className="text-sm font-semibold text-gray-700">Phát hiện API trên gateway</div>
                {apiProbeError && <div className="text-xs text-red-600">Lỗi khi kiểm tra API: {apiProbeError}</div>}
                <div className="flex flex-wrap gap-2">
                  {apiModules.length === 0 && <div className="text-xs text-gray-500">Không tìm thấy module nào.</div>}
                  {apiModules.map((m) => (
                    <div key={m} className="px-3 py-1 rounded-lg border text-xs flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${moduleStatuses[m]?.ok ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      <span className="font-medium">{m}</span>
                      <span className="text-xs text-gray-500"> {moduleStatuses[m]?.ok ? 'ok' : (moduleStatuses[m]?.error ?? 'unknown')}</span>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500">Ghi chú: đây là kiểm tra chỉ đọc; không thay đổi API. Nếu thấy module cần tích hợp, cho tôi biết tên module.</div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Thông tin buổi học</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-xs text-blue-600 font-semibold">1-on-1 Mock Session</span>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-sm relative">
                    <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxBuBYiyBoTsFGaXdyxuxkCZbkqvpRlKd1dNx347e4YW4ky6tfYhM-CNPspTn-wB81B0vbuOKvZ_3bSioo2-9HZ2jUT3RLkO3KJD8jN2Efmo5Xk_07cJPhbYR0BRtwtNW-FE_3OzIx0Ert6ftGj2z-cPip3yJufLYCVCw5oVjp2_H0aupFXswJXYI92VN-0u-AlIWDcxjDOodSonAsy9FKahFP2x63mDsevetJ8_8TpnUecWYQP48x" alt="Chân dung giảng viên" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white text-[10px]">check</span></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-gray-900 leading-snug">Luyện Speaking IELTS 6.5+ Mock Interview 1-1</h2>
                    <div className="flex items-center gap-2 mt-1"><span className="text-sm font-semibold text-blue-600">Lan Anh</span><span className="w-1 h-1 rounded-full bg-gray-300" />
                      <span className="text-xs text-gray-500">FTU K60 (Ngoại Thương)</span></div>
                    <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold"><span className="material-symbols-outlined text-[13px]">verified_user</span><span>Thẻ SV Đã xác thực • IELTS 8.0</span></div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white rounded-lg p-2 border border-gray-100"><div className="text-[11px] text-gray-500">Chủ đề thảo luận</div><div className="text-xs text-gray-900 font-bold truncate">Part 2 &amp; 3 Education</div></div>
                  <div className="bg-white rounded-lg p-2 border border-gray-100"><div className="text-[11px] text-gray-500">Đường truyền Jitsi</div><div className="text-xs text-emerald-600 font-bold">1080p Rõ nét</div></div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-emerald-600 text-[22px]">account_balance</span><h3 className="text-base text-gray-900 font-bold">Thanh toán &amp; Giữ cọc Escrow</h3></div><span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">Đã giải ngân an toàn</span></div>
                <p className="text-xs text-gray-600 leading-relaxed">Hệ thống tự động chuyển số Credit từ quỹ bảo lãnh sang Ví giảng viên sau khi phiên học kết thúc suôn sẻ.</p>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-gray-900"><span className="text-sm font-medium">Tổng chi phí buổi học</span><span className="text-xl font-bold text-blue-600">90 Credit</span></div>
                  <div className="w-full h-2 rounded-full bg-gray-200 flex overflow-hidden"><div className="h-full bg-emerald-500" style={{width: '90%'}} title="Giảng viên"></div><div className="h-full bg-gray-400" style={{width: '10%'}} title="Phí hệ thống"></div></div>
                  <div className="pt-1 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-gray-800"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span><span>Ví giảng viên Lan Anh (90%)</span></div><span className="text-sm text-emerald-600 font-bold">+81 Credit</span></div>
                    <div className="flex items-center justify-between text-gray-500"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-400"></span><span>Phí duy trì hệ thống (10%)</span></div><span className="text-xs font-semibold text-gray-700">9 Credit</span></div>
                  </div>
                </div>
                <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3 flex items-center justify-between text-left"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-blue-600 text-[18px]">check_circle</span><span className="text-xs text-gray-800">Số dư khả dụng hiện tại: <strong className="text-blue-700 font-bold">150 Credit</strong></span></div><a className="text-xs text-blue-600 hover:underline font-semibold" data-path="wallet" href="#">Xem ví →</a></div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
                <div className="flex items-center justify-between"><h3 className="text-base text-gray-900 font-bold flex items-center gap-2"><span className="material-symbols-outlined text-blue-600 text-[20px]">assignment_turned_in</span><span>Tài liệu &amp; Ghi chú buổi học</span></h3><span className="text-xs text-gray-500">2 tệp</span></div>
                <p className="text-xs text-gray-600">Tải bản nhận xét Speaking chi tiết và phiếu tổng kết phát âm của buổi học.</p>
                <div className="space-y-2 pt-1">
                  <a className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group border border-gray-100" href="#"><div className="flex items-center gap-3 min-w-0"><div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[18px]">description</span></div><div className="truncate"><div className="text-xs font-semibold text-gray-900 truncate">Speaking_Critique_SS8821.pdf</div><div className="text-[11px] text-gray-500">2.4 MB • Nhận xét ngữ pháp &amp; từ vựng</div></div></div><span className="material-symbols-outlined text-gray-400 group-hover:text-blue-600 transition-colors text-[20px]">download</span></a>
                  <a className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group border border-gray-100" href="#"><div className="flex items-center gap-3 min-w-0"><div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[18px]">mic</span></div><div className="truncate"><div className="text-xs font-semibold text-gray-900 truncate">Audio_Sample_Intonation.mp3</div><div className="text-[11px] text-gray-500">5.1 MB • Ghi âm mẫu ngữ điệu Part 3</div></div></div><span className="material-symbols-outlined text-gray-400 group-hover:text-emerald-600 transition-colors text-[20px]">download</span></a>
                </div>
              </div>
            </div>

            {/* Right Column (Form)*/}
            <div className="lg:col-span-7 space-y-5">
              <form className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6" onSubmit={(e)=>{e.preventDefault(); submitReview();}}>
                <div className="space-y-1">
                  <div className="flex items-center justify-between"><span className="text-xs text-blue-600 font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">verified</span>Đánh giá người học</span><span className="text-xs text-gray-400">Sinh viên RMIT → FTU</span></div>
                  <h2 className="text-xl text-gray-900 font-bold">Đánh giá chất lượng &amp; Giảng viên</h2>
                  <p className="text-sm text-gray-600">Góp ý của bạn giúp Lan Anh cải thiện chất lượng giảng dạy và tích lũy uy tín học thuật trong cộng đồng.</p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-5 text-center space-y-2 border border-gray-100">
                  <span className="text-sm text-gray-900 font-semibold block">Mức độ hài lòng chung về buổi học</span>
                  <div className="flex items-center justify-center gap-2" id="starContainer">
                    {[1,2,3,4,5].map((v)=> (
                      <button key={v} type="button" onClick={()=>setRating(v)} className={`star-btn focus:outline-none transition-transform hover:scale-125 ${v<=rating? 'text-amber-400': 'text-gray-300'}`}>
                        <span className="material-symbols-outlined text-[36px]" style={{fontVariationSettings: v<=rating ? "'FILL' 1" : "'FILL' 0"}}>star</span>
                      </button>
                    ))}
                  </div>
                  <div className="text-sm text-amber-600 font-bold">{starTexts[rating]}</div>
                </div>

                {/* 4 criteria */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-gray-900">Đánh giá theo 4 tiêu chí cốt lõi</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.keys(criteria).map((k)=> (
                      <div key={k} className="bg-gray-50 rounded-xl p-3 space-y-1.5 border border-gray-100">
                        <div className="flex justify-between items-center text-gray-900">
                          <span className="text-xs font-semibold">{k.replace(/^\d+\.\s*/, (m)=>m)}</span>
                          <span className="text-xs font-bold text-blue-600">{criteria[k]} / 5</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full" style={{width: `${(criteria[k]/5)*100}%`}} /></div>
                        <span className="text-[11px] text-gray-500 block">{k.includes('Chuyên môn')? 'Nắm vững format kỳ thi, giải thích chuẩn xác' : k.includes('Hạ tầng')? 'Âm thanh rõ, micro lọc ồn tốt, không giật lag' : 'Ghi chú phản xạ phát âm chi tiết từng câu'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Written review & chips */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-900 font-bold block">Nhận xét chi tiết cho giảng viên</label>
                  <p className="text-xs text-gray-500">Chọn nhanh phản hồi nổi bật bên dưới để thêm vào nội dung đánh giá:</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button type="button" className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-700 text-xs" onClick={()=>addChipText('Giải thích dễ hiểu, logic')}>+ Giải thích dễ hiểu, logic</button>
                    <button type="button" className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-700 text-xs" onClick={()=>addChipText('Sửa phát âm và nối âm rất chi tiết')}>+ Sửa phát âm &amp; nối âm rất chi tiết</button>
                    <button type="button" className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-700 text-xs" onClick={()=>addChipText('Tài liệu sát đề thi quý mới nhất')}>+ Tài liệu sát đề thi quý mới nhất</button>
                    <button type="button" className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-700 text-xs" onClick={()=>addChipText('Tạo cảm giác tự tin, không bị áp lực')}>+ Tạo cảm giác tự tin, không bị áp lực</button>
                  </div>
                  <textarea className="w-full mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" value={comment} onChange={(e)=>setComment(e.target.value)} rows={4} />
                </div>

                {/* Skill swap */}
                <div className="bg-gray-50 rounded-2xl p-5 space-y-2 border border-gray-100">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 text-blue-600"><span className="material-symbols-outlined text-[20px]">swap_horizontal_circle</span><span className="text-sm font-bold">Cơ hội Đổi chéo kỹ năng (Skill Swap)</span></div><span className="text-xs text-gray-400">Gợi ý tương thích</span></div>
                  <p className="text-xs text-gray-600">Lan Anh đang muốn học thêm <strong>Python</strong> hoặc <strong>Thiết kế Figma UI/UX</strong>. Bạn có muốn đổi kỹ năng 1-1 cho các buổi tiếp theo?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"><input type="checkbox" checked={skillSwap.python} onChange={()=>toggleSkillSwap('python')} className="w-4 h-4 rounded text-blue-600 focus:ring-0" /><span className="text-xs text-gray-800 font-medium">Đề xuất đổi: Python ↔ IELTS</span></label>
                    <label className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"><input type="checkbox" checked={skillSwap.saveContact} onChange={()=>toggleSkillSwap('saveContact')} className="w-4 h-4 rounded text-blue-600 focus:ring-0" /><span className="text-xs text-gray-800 font-medium">Lưu vào Danh bạ cố vấn</span></label>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <a className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold transition-colors text-center" href="#">Quay lại Trang chủ Khám phá</a>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button id="btnSubmitReview" type="submit" disabled={submitting} className={`w-full sm:w-auto px-6 py-2.5 rounded-xl ${submitting? 'bg-blue-500':'bg-blue-600'} hover:bg-blue-700 text-white text-sm shadow-sm transition-all flex items-center justify-center gap-2 font-semibold`}>
                      <span className="material-symbols-outlined text-[18px]">{submitting? 'refresh':'send'}</span>
                      <span>{submitting? 'Đang đồng bộ Escrow...':'Gửi đánh giá & Hoàn tất'}</span>
                    </button>
                  </div>
                </div>
              </form>

              <div className={`rounded-2xl border p-4 shadow-sm flex items-center gap-3 transition-all ${toastVisible? 'bg-emerald-50 border-emerald-200 text-emerald-800':'hidden'}`}>
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[24px]">verified</span></div>
                <div className="flex-1">
                  <div className="text-sm font-bold">Đánh giá đã được ghi nhận trên Blockchain/Ledger!</div>
                  <div className="text-xs text-emerald-700">Cảm ơn bạn. Hồ sơ tín nhiệm của Lan Anh đã tăng +0.2 điểm. Đang chuyển hướng về trang lớp học của bạn...</div>
                </div>
              </div>
            </div>
          </div>

          <footer className="w-full bg-white border-t border-gray-100 py-8">
            <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-2"><div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">S</div><p>© 2025 SkillSwap Vietnam. Nền tảng trao đổi kỹ năng sinh viên P2P.</p></div>
              <div className="flex items-center gap-6 font-medium"><a className="hover:text-blue-600 transition-colors" href="#">Trợ giúp</a><a className="hover:text-blue-600 transition-colors" href="#">Quy định</a><a className="hover:text-blue-600 transition-colors" href="#">Bảo mật</a><div className="flex items-center gap-1 text-gray-600 font-semibold"><span className="material-symbols-outlined text-[14px]">language</span><span>Tiếng Việt</span></div></div>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

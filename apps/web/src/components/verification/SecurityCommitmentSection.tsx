export default function SecurityCommitmentSection() {
  const items = [
    {
      icon: "school",
      title: "Email trường .edu.vn",
      body: "100% học viên và giảng viên được kiểm tra định danh chính thức qua hòm thư sinh viên còn hiệu lực.",
    },
    {
      icon: "lock_person",
      title: "Bảo mật danh tính cá nhân",
      body: "Dữ liệu nhạy cảm được ẩn hoàn toàn. Thành viên chỉ nhìn thấy biệt danh xác thực và trường theo học.",
    },
    {
      icon: "autorenew",
      title: "Tái thẩm định theo niên khóa",
      body: "Thẻ sinh viên được rà soát định kỳ hàng năm để bảo đảm tư cách thành viên và chất lượng giảng dạy.",
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="mb-4 text-center max-w-3xl mx-auto">
        <h3 className="text-lg font-bold text-gray-900">Cam kết An toàn &amp; Bảo mật SkillSwap</h3>
        <p className="text-sm text-gray-500 mt-1">Môi trường trao đổi học thuật chuẩn mực, minh bạch và tôn trọng quyền riêng tư sinh viên.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.title} className="p-4 rounded-xl bg-gray-50 space-y-2 h-full">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-[20px]">{it.icon}</span>
            </div>
            <h4 className="text-sm font-bold text-gray-900">{it.title}</h4>
            <p className="text-xs text-gray-500">{it.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
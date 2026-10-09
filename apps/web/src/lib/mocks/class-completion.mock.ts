import type { CompletionData } from "../../types/class-completion";

export const completionSuccess: CompletionData = {
  session: {
    id: "s1",
    title: "Lớp: Kỹ năng giao tiếp chuyên nghiệp",
    date: "2026-10-12",
    durationMinutes: 90,
    location: "Online (Zoom)",
  },
  teacher: {
    id: "t1",
    name: "Nguyễn Văn A",
    avatarUrl: undefined,
    rating: 4.8,
  },
  escrow: {
    totalCredits: 100000,
    teacherShare: 85000,
    platformFee: 15000,
    studentRefund: 0,
  },
  documents: [
    { id: "d1", name: "Slide buổi học.pdf" },
    { id: "d2", name: "Bài tập về nhà.docx" },
  ],
  suggestions: [
    { id: "p1", title: "Thực hành phản hồi 1:1", description: "30 phút cùng mentor" },
    { id: "p2", title: "Mini-workshop: Thuyết trình", description: "Tối đa 8 người" },
  ],
  rating: 5,
};

export const completionLoading: CompletionData = {
  session: null,
  teacher: null,
  escrow: null,
  documents: [],
  suggestions: [],
};

export const completionError: CompletionData = {
  session: null,
  teacher: null,
  escrow: null,
  documents: [],
  suggestions: [],
};

export const completionEmpty: CompletionData = {
  session: {
    id: "s-none",
    title: "Không có buổi học",
    date: "",
    durationMinutes: 0,
  },
  teacher: null,
  escrow: null,
  documents: [],
  suggestions: [],
};

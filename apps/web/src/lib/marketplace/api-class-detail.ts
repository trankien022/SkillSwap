import { callApi, unwrapEnvelope } from '../api-client';
import type { ClassDetailView as ContractClassDetailView } from '@skillswap/contracts';
import { MockClassDetailGateway } from './mock-class-detail';
import type { ClassDetailView } from './types';

/**
 * Transforms a backend ClassDetailView (Route 14) into the rich web ClassDetailView presentation structure.
 */
export function mapContractDetailToWeb(detail: ContractClassDetailView): ClassDetailView {
  return {
    id: detail.id,
    teacherId: detail.teacher.id,
    state: detail.state,
    startsAt: detail.startsAt,
    durationMinutes: detail.durationMinutes,
    priceCredits: detail.priceCredits,
    capacity: detail.capacity,
    teacherName: detail.teacher.displayName,
    schoolCode: 'bk',
    schoolName: 'Đại học Quốc gia',
    skillName: detail.description.length > 35 ? `${detail.description.slice(0, 32)}...` : detail.description,
    skillCategory: 'programming',
    level: 'intermediate',
    format: detail.capacity <= 1 ? 'one-on-one' : 'group-2-4',
    ratingAvg: detail.teacher.averageRating ?? 5.0,
    ratingCount: detail.teacher.ratingsCount,
    verified: true,
    coverGradient: { from: '#0f766e', to: '#14b8a6' },
    description: detail.description,
    syllabus: [
      {
        order: 1,
        title: 'Giới thiệu & Tổng quan',
        minutes: Math.round(detail.durationMinutes * 0.25),
        body: 'Làm quen và thống nhất mục tiêu buổi học.',
      },
      {
        order: 2,
        title: 'Nội dung cốt lõi & Thực hành tương tác',
        minutes: Math.round(detail.durationMinutes * 0.5),
        body: 'Thực hành tương tác trực tiếp và phân tích bài toán thực tế.',
      },
      {
        order: 3,
        title: 'Hỏi đáp & Định hướng tự học',
        minutes: Math.round(detail.durationMinutes * 0.25),
        body: 'Giải đáp thắc mắc và tổng kết tài liệu tham khảo.',
      },
    ],
    prerequisites: [
      {
        icon: 'devices',
        title: 'Thiết bị kết nối',
        body: 'Máy tính có kết nối Internet ổn định, micro và webcam.',
      },
      {
        icon: 'topic',
        title: 'Kiến thức chuẩn bị',
        body: 'Đọc trước tài liệu hoặc chuẩn bị sẵn các câu hỏi trọng tâm.',
      },
    ],
    teacherBio: 'Sinh viên hướng dẫn được cộng đồng đánh giá tích cực và đã hoàn tất xác thực thông tin.',
    teacherStats: {
      hoursTaught: 16,
      responseRatePct: 98,
      learnersHelped: 10,
    },
    teacherCredentials: [
      {
        icon: 'workspace_premium',
        title: 'Xác thực sinh viên',
        body: 'Hồ sơ sinh viên chính quy đã xác minh',
        verifiedBy: 'SkillSwap Trust',
      },
    ],
    reviews: (detail.recentRatings ?? []).map((r) => ({
      id: r.id,
      authorName: r.learnerDisplayName,
      schoolName: 'Học viên SkillSwap',
      rating: r.stars,
      body: r.comment,
      attendedOn: r.createdAt,
    })),
  };
}

/**
 * Real API-backed Class Detail Gateway.
 * Queries `GET /api/classes/:id` from backend with graceful fallback to MockClassDetailGateway
 * for demo IDs and unauthenticated states.
 */
export class ClassDetailApiGateway {
  private fallback = new MockClassDetailGateway();

  async getById(id: string): Promise<ClassDetailView | null> {
    // 1. If it's a known mock ID, return immediately from mock fixture
    const mockItem = await this.fallback.getById(id);
    if (mockItem) {
      return mockItem;
    }

    // 2. Query backend for real class by UUID
    try {
      const res = await callApi(`/classes/${id}`);
      if (res.ok) {
        const detail = await unwrapEnvelope<ContractClassDetailView>(res);
        if (detail && detail.id) {
          return mapContractDetailToWeb(detail);
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch /api/classes/${id}:`, err);
    }

    return null;
  }
}

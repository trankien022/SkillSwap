import { translator } from '@/i18n';
import {
  getLocalizedAuthError,
  validateAuthInput,
  type AuthInput,
} from './auth-validation';

describe('AuthForm validation & localized error handling', () => {
  const tEn = translator('en');
  const tVi = translator('vi');

  describe('validateAuthInput - sign-in mode', () => {
    it('rejects empty or malformed emails', () => {
      const inputs: AuthInput[] = [
        { email: '', password: 'password123' },
        { email: 'invalid-email', password: 'password123' },
        { email: 'user@', password: 'password123' },
        { email: '@domain.com', password: 'password123' },
      ];

      for (const input of inputs) {
        const resEn = validateAuthInput(input, 'sign-in', tEn);
        expect(resEn.valid).toBe(false);
        expect(resEn.error).toBe('Please enter a valid email address.');

        const resVi = validateAuthInput(input, 'sign-in', tVi);
        expect(resVi.valid).toBe(false);
        expect(resVi.error).toBe('Vui lòng nhập địa chỉ email hợp lệ.');
      }
    });

    it('rejects passwords shorter than 8 characters', () => {
      const input: AuthInput = {
        email: 'learner@school.edu.vn',
        password: 'short',
      };

      const resEn = validateAuthInput(input, 'sign-in', tEn);
      expect(resEn.valid).toBe(false);
      expect(resEn.error).toBe('Password must be at least 8 characters long.');

      const resVi = validateAuthInput(input, 'sign-in', tVi);
      expect(resVi.valid).toBe(false);
      expect(resVi.error).toBe('Mật khẩu phải có ít nhất 8 ký tự.');
    });

    it('accepts valid credentials on sign-in without requiring displayName or confirmPassword', () => {
      const input: AuthInput = {
        email: 'student@school.edu.vn',
        password: 'securePassword123',
      };

      const res = validateAuthInput(input, 'sign-in', tEn);
      expect(res.valid).toBe(true);
      expect(res.error).toBeNull();
    });
  });

  describe('validateAuthInput - register mode', () => {
    it('requires non-empty trimmed displayName', () => {
      const inputs: AuthInput[] = [
        {
          email: 'student@school.edu.vn',
          password: 'securePassword123',
          confirmPassword: 'securePassword123',
          displayName: '',
        },
        {
          email: 'student@school.edu.vn',
          password: 'securePassword123',
          confirmPassword: 'securePassword123',
          displayName: '   ',
        },
      ];

      for (const input of inputs) {
        const resEn = validateAuthInput(input, 'register', tEn);
        expect(resEn.valid).toBe(false);
        expect(resEn.error).toBe('Please enter your full name.');

        const resVi = validateAuthInput(input, 'register', tVi);
        expect(resVi.valid).toBe(false);
        expect(resVi.error).toBe('Vui lòng nhập họ và tên.');
      }
    });

    it('rejects password confirmation mismatch', () => {
      const input: AuthInput = {
        email: 'student@school.edu.vn',
        displayName: 'Nguyen Van A',
        password: 'securePassword123',
        confirmPassword: 'differentPassword456',
      };

      const resEn = validateAuthInput(input, 'register', tEn);
      expect(resEn.valid).toBe(false);
      expect(resEn.error).toBe('Passwords do not match.');

      const resVi = validateAuthInput(input, 'register', tVi);
      expect(resVi.valid).toBe(false);
      expect(resVi.error).toBe('Mật khẩu xác nhận không khớp.');
    });

    it('accepts valid complete registration credentials', () => {
      const input: AuthInput = {
        email: 'student@school.edu.vn',
        displayName: 'Nguyen Van A',
        password: 'securePassword123',
        confirmPassword: 'securePassword123',
      };

      const resEn = validateAuthInput(input, 'register', tEn);
      expect(resEn.valid).toBe(true);
      expect(resEn.error).toBeNull();
    });
  });

  describe('getLocalizedAuthError', () => {
    it('maps network failures to generic localized connection error message', () => {
      const networkErr = new Error('Network request failed: Gateway unreachable');
      expect(getLocalizedAuthError(networkErr, false, tEn)).toBe(
        'Unable to connect to gateway. Please check connection and try again.',
      );
      expect(getLocalizedAuthError(networkErr, false, tVi)).toBe(
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.',
      );
    });

    it('maps auth failures to localized sign-in or registration messages', () => {
      const authErr = new Error('Invalid credentials');
      expect(getLocalizedAuthError(authErr, false, tEn)).toBe(
        'Authentication failed. Please verify your credentials.',
      );
      expect(getLocalizedAuthError(authErr, false, tVi)).toBe(
        'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.',
      );

      expect(getLocalizedAuthError(authErr, true, tEn)).toBe(
        'Registration failed. Please try again later.',
      );
      expect(getLocalizedAuthError(authErr, true, tVi)).toBe(
        'Đăng ký không thành công. Vui lòng thử lại sau.',
      );
    });
  });
});

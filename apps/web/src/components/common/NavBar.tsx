import type { FC } from 'react';

type NavBarProps = { locale: string };

const NavBar: FC<NavBarProps> = ({ locale }) => {
  return (
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
      <a className="hover:text-blue-600 transition-colors" data-path="explore" href={`/${locale}/explore`}>Khám phá</a>
      <a className="text-blue-600 font-semibold" data-path="my-classes" href={`/${locale}/myclass`}>Lớp học của tôi</a>
      <a className="hover:text-blue-600 transition-colors" data-path="teacher-dashboard" href={`/${locale}/teacher`}>Studio Giảng dạy</a>
      <a className="hover:text-blue-600 transition-colors" data-path="wallet" href={`/${locale}/wallet`}>Ví &amp; Tín dụng</a>
      <a className="hover:text-blue-600 transition-colors" data-path="verification" href={`/${locale}/verification`}>Xác minh</a>
    </nav>
  );
};

export default NavBar;

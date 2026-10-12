import type { FC } from 'react';

type NavBarProps = { locale: string };

const NavBar: FC<NavBarProps> = ({ locale }) => {
  return (
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
      <a className="hover:text-blue-600 transition-colors" data-path="explore" href={`/${locale}/explore`}>{locale === 'vi' ? 'Khám phá' : 'Explore'}</a>
      <a className="text-blue-600 font-semibold" data-path="my-classes" href={`/${locale}/myclass`}>{locale === 'vi' ? 'Lớp học của tôi' : 'My classes'}</a>
      <a className="hover:text-blue-600 transition-colors" data-path="teacher-dashboard" href={`/${locale}/teacher`}>{locale === 'vi' ? 'Studio Giảng dạy' : 'Teaching studio'}</a>
      <a className="hover:text-blue-600 transition-colors" data-path="wallet" href={`/${locale}/wallet`}>{locale === 'vi' ? 'Ví & Tín dụng' : 'Wallet & credits'}</a>
      <a className="hover:text-blue-600 transition-colors" data-path="verification" href={`/${locale}/verification`}>{locale === 'vi' ? 'Xác minh' : 'Verification'}</a>
    </nav>
  );
};

export default NavBar;

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from '../../i18n/routing';
import { getTokens } from '../../lib/api-client';
import type { SkillCategory } from '../../lib/marketplace/types';

/** Preserve a selected subject through sign-in, just like the header entry. */
export function DiscoveryLink({
  locale,
  category,
  className,
  children,
}: {
  locale: string;
  category?: SkillCategory;
  className: string;
  children: ReactNode;
}) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(Boolean(getTokens()));
  }, []);
  const destination = `/classes${category ? `?category=${category}` : ''}`;
  const returnUrl = encodeURIComponent(`/${locale}${destination}`);
  return (
    <Link
      className={className}
      href={signedIn ? destination : `/auth?tab=login&returnUrl=${returnUrl}`}
    >
      {children}
    </Link>
  );
}

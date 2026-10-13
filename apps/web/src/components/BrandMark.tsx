import Image from 'next/image';

/**
 * The single brand mark for the web client.
 *
 * Before this existed the landing header rendered `logo-skillswap-header.png`
 * while every other page (the shared Navbar) rendered an invented green "S"
 * tile next to a text wordmark — so the product showed two different logos
 * depending on the page. Both headers now render this component, and the PNG
 * under `public/logo-skillswap-header.png` stays the only source of truth.
 *
 * The mobile client shows the wordmark as a navigation title and has no logo
 * image; that is a recorded limitation, not parity. Do not invent an asset here
 * to close the gap — add one deliberately, with the design source, or not at all.
 */
export interface BrandMarkProps {
  /** Extra classes for spacing/alignment; sizing comes from `.header-logo`. */
  readonly className?: string;
}

export function BrandMark({ className = '' }: BrandMarkProps = {}) {
  return (
    <Image
      src="/logo-skillswap-header.png"
      alt="SkillSwap"
      width={180}
      height={32}
      priority
      className={`header-logo ${className}`.trim()}
    />
  );
}

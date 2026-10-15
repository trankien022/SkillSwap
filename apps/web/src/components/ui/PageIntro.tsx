import Image from 'next/image';
import type { ReactNode } from 'react';

export type LearningArt =
  'online-learning' | 'peer-learning' | 'programming' | 'design' | 'languages';

/** A compact page introduction, leaving the task and its controls in view. */
export function PageIntro({
  title,
  description,
  actions,
  art,
  artAlt = '',
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  art?: LearningArt;
  artAlt?: string;
}) {
  return (
    <header className={`workspace-intro${art ? ' workspace-intro-illustrated' : ''}`}>
      <div className="workspace-intro-content">
        <h1 className="workspace-title">{title}</h1>
        {description && <p className="workspace-description">{description}</p>}
        {actions && <div className="workspace-intro-actions">{actions}</div>}
      </div>
      {art && (
        <Image
          src={`/learning/${art}.webp`}
          alt={artAlt}
          width={560}
          height={373}
          sizes="(max-width: 639px) 120px, 280px"
          className="workspace-intro-art"
        />
      )}
    </header>
  );
}

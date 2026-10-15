import Image from 'next/image';
import type { ReactNode } from 'react';
import type { LearningArt } from './PageIntro';

export function StatePanel({
  title,
  children,
  action,
  art = 'online-learning',
  tone = 'neutral',
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  art?: LearningArt;
  tone?: 'neutral' | 'error';
}) {
  return (
    <section className={`workspace-state workspace-state-${tone}`}>
      <Image src={`/learning/${art}.webp`} alt="" width={400} height={267} sizes="200px" />
      <div>
        <h2>{title}</h2>
        {children && <div className="workspace-state-body">{children}</div>}
        {action && <div className="workspace-intro-actions">{action}</div>}
      </div>
    </section>
  );
}

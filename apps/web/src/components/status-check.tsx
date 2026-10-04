'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_API_BASE,
  fetchApiHealth,
  fetchGatewayHealth,
  type ApiHealth,
  type GatewayHealth,
} from '../lib/status';

type Phase = 'checking' | 'up' | 'down';

interface Probe<T> {
  phase: Phase;
  data?: T;
}

interface CardProps {
  title: string;
  badge: string;
  badgeClasses: string;
}

function Card({ title, badge, badgeClasses }: CardProps) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses}`}>
        {badge}
      </span>
    </article>
  );
}

const checkingClasses = 'bg-slate-100 text-slate-600';
const upClasses = 'bg-emerald-100 text-emerald-700';
const degradedClasses = 'bg-amber-100 text-amber-700';
const downClasses = 'bg-red-100 text-red-700';

export function StatusCheck() {
  const t = useTranslations('Status');
  const [gateway, setGateway] = useState<Probe<GatewayHealth>>({ phase: 'checking' });
  const [api, setApi] = useState<Probe<ApiHealth>>({ phase: 'checking' });
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setGateway({ phase: 'checking' });
    setApi({ phase: 'checking' });
    const [gatewayResult, apiResult] = await Promise.allSettled([
      fetchGatewayHealth(),
      fetchApiHealth(),
    ]);
    setGateway(
      gatewayResult.status === 'fulfilled'
        ? { phase: 'up', data: gatewayResult.value }
        : { phase: 'down' },
    );
    setApi(
      apiResult.status === 'fulfilled'
        ? { phase: 'up', data: apiResult.value }
        : { phase: 'down' },
    );
    setCheckedAt(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const gatewayBadge = gateway.phase === 'checking' ? t('checking') : gateway.phase === 'up' ? t('operational') : t('down');
  const gatewayClasses = gateway.phase === 'checking' ? checkingClasses : gateway.phase === 'up' ? upClasses : downClasses;

  const apiDegraded = api.phase === 'up' && api.data?.status === 'degraded';
  const apiBadge =
    api.phase === 'checking' ? t('checking') : api.phase === 'down' ? t('down') : apiDegraded ? t('degraded') : t('operational');
  const apiClasses =
    api.phase === 'checking' ? checkingClasses : api.phase === 'down' ? downClasses : apiDegraded ? degradedClasses : upClasses;

  return (
    <section className="mt-8 space-y-4" aria-label={t('title')}>
      <Card title={t('gateway')} badge={gatewayBadge} badgeClasses={gatewayClasses} />
      <Card title={t('api')} badge={apiBadge} badgeClasses={apiClasses} />
      {gateway.phase === 'down' ? (
        <p className="text-sm text-red-600">{t('failed', { url: DEFAULT_API_BASE })}</p>
      ) : null}
      {api.phase === 'down' ? (
        <p className="text-sm text-red-600">
          {t('failed', { url: `${DEFAULT_API_BASE}/api/health` })}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="text-sm text-slate-500">
          {checkedAt ? t('lastChecked', { time: checkedAt }) : ''}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {t('refresh')}
        </button>
      </div>
    </section>
  );
}

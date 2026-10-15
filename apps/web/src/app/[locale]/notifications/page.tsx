'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Navbar } from '../../../components/navbar';
import { PageIntro } from '../../../components/ui/PageIntro';
import { StatePanel } from '../../../components/ui/StatePanel';
import { WorkspaceFooter } from '../../../components/ui/WorkspaceFooter';
import { fetchNotifications, type UINotificationItem } from '../../../lib/notifications/api-notifications';
export default function NotificationsPage() {
 const locale=useLocale(); const t=useTranslations('Workspace.notifications');
 const [items,setItems]=useState<UINotificationItem[]>([]);
 const [phase,setPhase]=useState<'loading'|'ready'|'error'>('loading');
 const [filter,setFilter]=useState('all');
 useEffect(()=>{ let active=true; fetchNotifications().then(result=>{if(!active)return; if(result){setItems(result.items);setPhase('ready');}else setPhase('error');});return ()=>{active=false;};},[]);
 const unread=items.filter(item=>item.unread).length;
 const visible=items.filter(item=>filter==='all'||(filter==='unread'?item.unread:item.category===filter));
 return <div className="flex min-h-dvh flex-col bg-mist text-ink"><Navbar currentTab="notifications" unreadNotificationsCount={unread}/><main id="main-content" tabIndex={-1} className="workspace-page workspace-page-narrow flex-1"><PageIntro title={t('title')} description={t('description')} actions={phase==='ready'&&unread>0?<button type="button" className="workspace-secondary" onClick={()=>setItems(current=>current.map(item=>({...item,unread:false})))}>{t('markViewed')}</button>:undefined}/>
 <div className="mb-6 flex flex-wrap gap-2">{['all','unread','booking','finance','verify'].map(value=><button type="button" key={value} onClick={()=>setFilter(value)} aria-pressed={filter===value} className={filter===value?'workspace-secondary ring-2 ring-ink':'workspace-secondary'}>{t(`filter.${value}`)}{value==='unread'?` (${unread})`:''}</button>)}</div>
 {phase==='loading'?<p role="status" className="workspace-panel">{t('loading')}</p>:phase==='error'?<StatePanel title={t('errorTitle')} tone="error" action={<a href={`/${locale}/auth?tab=login`} className="workspace-primary">{t('signIn')}</a>}>{t('errorBody')}</StatePanel>:visible.length===0?<StatePanel title={t('emptyTitle')} action={<a href={`/${locale}/classes`} className="workspace-primary">{t('explore')}</a>}>{t('emptyBody')}</StatePanel>:<div className="space-y-4">{visible.map(item=><article key={item.id} className="workspace-panel"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-ink-soft">{t(`filter.${item.category}`)}</span><span className={`rounded-full px-3 py-1 text-sm ${item.unread?'bg-success-tint text-success-ink':'bg-neutral-tint text-ink-soft'}`}>{item.unread?t('unread'):t('viewed')}</span></div><h2 className="workspace-panel-title">{item.title}</h2><p className="mt-3 text-base leading-relaxed text-ink-soft">{item.content}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><time className="text-sm text-ink-soft">{new Date(item.createdAt).toLocaleString(locale)}</time><a className="workspace-link" href={`/${locale}/${item.category==='finance'?'wallet':item.category==='verify'?'verification':'bookings'}`}>{t('open')} ↗</a></div>{item.unread&&<button type="button" className="workspace-secondary mt-3" onClick={()=>setItems(current=>current.map(other=>other.id===item.id?{...other,unread:false}:other))}>{t('markSingle')}</button>}</article>)}</div>}
 <p className="mt-6 text-sm leading-relaxed text-ink-soft">{t('sessionHint')}</p>
 </main><WorkspaceFooter/></div>;
}

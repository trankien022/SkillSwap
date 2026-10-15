import { getTranslations } from 'next-intl/server';
import { PageIntro } from '../ui/PageIntro';
export async function PublishHeader() {
 const t = await getTranslations('Teacher.publish');
 return <PageIntro title={t('title')} description={t('description')} art="design" artAlt={t('artAlt')}/>;
}

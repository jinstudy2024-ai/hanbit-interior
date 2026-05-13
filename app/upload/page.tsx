import { PageHeader } from '@/components/PageHeader';
import { requireUser } from '@/lib/auth';
import { UploadDropzone } from './UploadDropzone';
import type { SiteRow } from '@/lib/supabase/types';

export const revalidate = 0;

export default async function UploadPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from('sites')
    .select('id, name, status')
    .order('created_at');
  const sites = (data ?? []) as Pick<SiteRow, 'id' | 'name' | 'status'>[];

  return (
    <>
      <PageHeader title="영수증 업로드" subtitle="현장을 선택하고 영수증을 드래그하세요" />
      <UploadDropzone sites={sites} />
    </>
  );
}

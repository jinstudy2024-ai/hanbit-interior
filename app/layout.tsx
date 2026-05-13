import type { Metadata } from 'next';
import './globals.css';
import { createClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/Sidebar';
import type { UserRow } from '@/lib/supabase/types';

export const metadata: Metadata = {
  title: '한빛인테리어 경비정산',
  description: '현장 경비 OCR 자동화 · 정책 검증 · 세무사 패키지',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile: UserRow | null = null;
  if (user) {
    const { data } = await supabase
      .from('users').select('*').eq('id', user.id).maybeSingle<UserRow>();
    profile = data;
  }

  return (
    <html lang="ko">
      <body>
        {profile ? (
          <div className="flex h-screen overflow-hidden">
            <Sidebar profile={profile} />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        ) : (
          <main>{children}</main>
        )}
      </body>
    </html>
  );
}

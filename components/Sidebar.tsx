'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRow, UserRole } from '@/lib/supabase/types';

type NavItem = {
  href: string;
  label: string;
  roles?: UserRole[];
  icon: string;
};

const NAV: NavItem[] = [
  { href: '/upload',       label: '영수증 업로드',  icon: '📤' },
  { href: '/my-receipts',  label: '내 영수증',      icon: '🧾' },
  { href: '/sites',        label: '현장 원가 현황', icon: '🏗️', roles: ['사장'] },
  { href: '/review',       label: '검수 대기',      icon: '🔍', roles: ['사장', '팀장'] },
  { href: '/violations',   label: '위반 결재',      icon: '⚠️', roles: ['사장', '팀장'] },
  { href: '/dashboard',    label: '월간 KPI',       icon: '📊', roles: ['사장'] },
  { href: '/tax-report',   label: '세무사 패키지',  icon: '📋', roles: ['사장', '세무사'] },
];

export function Sidebar({ profile }: { profile: UserRow }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV.filter(n => !n.roles || n.roles.includes(profile.role));

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white md:flex md:flex-col">
      <div className="border-b border-gray-200 px-5 py-5">
        <div className="text-xs font-medium text-gray-500">HANBIT INTERIOR</div>
        <div className="mt-1 text-lg font-bold text-brand">경비정산 자동화</div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-gray-700 hover:bg-brand-50 hover:text-brand'
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-4">
        <div className="mb-2 text-xs text-gray-500">로그인 정보</div>
        <div className="text-sm font-semibold text-gray-900">
          {profile.name ?? profile.email}
        </div>
        <div className="text-xs text-gray-500">{profile.role}</div>
        <button onClick={logout} className="mt-3 w-full btn-secondary text-xs">
          로그아웃
        </button>
      </div>
    </aside>
  );
}

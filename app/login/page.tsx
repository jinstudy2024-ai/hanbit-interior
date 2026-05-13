'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/my-receipts';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-800 to-brand-500 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <div className="text-4xl">🏗️</div>
          <h1 className="mt-3 text-2xl font-bold">한빛인테리어</h1>
          <p className="mt-1 text-sm text-brand-100">현장 경비정산 자동화 시스템</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="boss@hanbit.co.kr"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-confidence-low">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-400 text-center mb-2">테스트 계정 (비밀번호: hanbit2026)</p>
            <div className="grid grid-cols-3 gap-1">
              {[
                ['boss@hanbit.co.kr', '사장'],
                ['team@hanbit.co.kr', '팀장'],
                ['tax@hanbit.co.kr',  '세무사'],
              ].map(([e, r]) => (
                <button
                  key={e}
                  type="button"
                  className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-brand-50"
                  onClick={() => { setEmail(e); setPassword('hanbit2026'); }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

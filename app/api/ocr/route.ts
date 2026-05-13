import { NextRequest, NextResponse } from 'next/server';

// 한빛인테리어 OCR 모킹 API (KRW 단일, 간이영수증 포함)
// 실서비스에서는 Naver Clova OCR / Google Vision / GPT-4o Vision으로 교체

const MERCHANTS = [
  // 고신뢰도 (0.92~0.99)
  { name: '삼성 건자재', biz: '101-23-45678', cat: '공구', supply_min: 30000, supply_max: 90000, simplified: false },
  { name: '인테리어 홈센터',   biz: '202-34-56789', cat: '공구', supply_min: 20000, supply_max: 80000, simplified: false },
  { name: '현장 식당',         biz: '303-45-67890', cat: '식대', supply_min: 8000,  supply_max: 25000, simplified: false },
  { name: '편의점 GS25',       biz: '404-56-78901', cat: '소모품', supply_min: 3000, supply_max: 15000, simplified: false },
  { name: '박재철 인테리어',   biz: '505-67-89012', cat: '공구', supply_min: 50000, supply_max: 90000, simplified: false },
  // 중신뢰도 (0.75~0.91)
  { name: '○○ 철물점',         biz: null,           cat: '공구', supply_min: 10000, supply_max: 30000, simplified: true  },
  { name: '동네 순대국밥',      biz: '606-78-90123', cat: '식대', supply_min: 6000,  supply_max: 20000, simplified: false },
  { name: '현장 근처 마트',     biz: null,           cat: '소모품', supply_min: 5000, supply_max: 25000, simplified: true  },
  // 저신뢰도 (0.55~0.74) — 간이영수증 위주
  { name: '무명 철물점',        biz: null,           cat: '공구', supply_min: 8000,  supply_max: 20000, simplified: true  },
  { name: '현금 영수증',        biz: null,           cat: '기타', supply_min: 30000, supply_max: 150000, simplified: true  },
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randDate() {
  const d = new Date();
  d.setDate(d.getDate() - rand(0, 30));
  return d.toISOString().split('T')[0];
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const files = form.getAll('files') as File[];

  // 신뢰도 분포: 60% 고신뢰도 / 25% 중신뢰도 / 15% 저신뢰도
  function pickMerchant() {
    const r = Math.random();
    if (r < 0.60) return MERCHANTS[rand(0, 4)];
    if (r < 0.85) return MERCHANTS[rand(5, 7)];
    return MERCHANTS[rand(8, 9)];
  }

  function confidence(m: typeof MERCHANTS[0]): number {
    if (!m.simplified && m.biz) {
      return Math.round((0.92 + Math.random() * 0.07) * 1000) / 1000;
    }
    if (!m.simplified) {
      return Math.round((0.75 + Math.random() * 0.16) * 1000) / 1000;
    }
    return Math.round((0.55 + Math.random() * 0.19) * 1000) / 1000;
  }

  const results = files.map((f, i) => {
    const m = pickMerchant();
    const supply = rand(m.supply_min, m.supply_max);
    const vat = m.biz ? Math.round(supply * 0.1) : 0;
    const total = supply + vat;

    return {
      file_name:    f.name,
      index:        i,
      date:         randDate(),
      merchant:     m.name,
      biz_no:       m.biz,
      supply,
      vat,
      total,
      category:     m.cat,
      is_simplified: m.simplified,
      confidence:   confidence(m),
    };
  });

  return NextResponse.json({ results });
}

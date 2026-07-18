#!/usr/bin/env node
/**
 * 음식 관련 제품 100k개를 Bright Data → Moss 로 세팅하는 스크립트
 *
 * 사용법:
 *   node scripts/seed-moss-food.mjs
 *
 * 환경변수 (.env.local 또는 export):
 *   BRIGHTDATA_API_KEY
 *   MOSS_FOOD_PROJECT_ID   (1dac9cc0-3bc8-4572-99af-fabd32a123b6)
 *   MOSS_FOOD_PROJECT_KEY  (moss_fWaVtfxNCJYVo2TJbTsJuqO7H4Nt583G)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MossClient } from '@moss-dev/moss';

// --- .env.local 로드 ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.+)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const BD_KEY    = process.env.BRIGHTDATA_API_KEY;
const MOSS_ID   = process.env.MOSS_FOOD_PROJECT_ID   || '1dac9cc0-3bc8-4572-99af-fabd32a123b6';
const MOSS_KEY  = process.env.MOSS_FOOD_PROJECT_KEY  || 'moss_fWaVtfxNCJYVo2TJbTsJuqO7H4Nt583G';
const DATASET_ID = 'gd_m4l6s4mn2g2rkx9lia';
const RECORDS_LIMIT = 100_000;
const REVIEW_MIN = 50;        // 리뷰 50개 이상만
const INDEX_NAME = 'food-products';
const BATCH_SIZE = 500;       // Moss addDocs 배치 크기

if (!BD_KEY) { console.error('BRIGHTDATA_API_KEY 없음'); process.exit(1); }

// ─────────────────────────────────────────
// 1. Bright Data filter 트리거
// ─────────────────────────────────────────
async function triggerFilter() {
  console.log(`\n[1/4] Bright Data filter 트리거 (food + reviews >= ${REVIEW_MIN}, limit=${RECORDS_LIMIT.toLocaleString()})...`);

  const body = {
    dataset_id: DATASET_ID,
    records_limit: RECORDS_LIMIT,
    filter: {
      operator: 'and',
      filters: [
        {
          operator: 'or',
          filters: [
            { name: 'department_amazon',       operator: '=', value: 'Grocery & Gourmet Food' },
            { name: 'root_category_name_walmart', operator: '=', value: 'Food' },
          ],
        },
        {
          operator: 'or',
          filters: [
            { name: 'reviews_count_amazon', operator: '>=', value: REVIEW_MIN },
            { name: 'review_count_walmart', operator: '>=', value: REVIEW_MIN },
          ],
        },
      ],
    },
  };

  const res = await fetch('https://api.brightdata.com/datasets/filter', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BD_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`filter 요청 실패 ${res.status}: ${txt}`);
  }

  const { snapshot_id } = await res.json();
  console.log(`  snapshot_id: ${snapshot_id}`);
  return snapshot_id;
}

// ─────────────────────────────────────────
// 2. 스냅샷 폴링 → 다운로드
// ─────────────────────────────────────────
async function downloadSnapshot(snapshotId) {
  console.log(`\n[2/4] 스냅샷 준비 대기 중...`);
  const url = `https://api.brightdata.com/datasets/snapshots/${snapshotId}/download?format=json`;
  const headers = { Authorization: `Bearer ${BD_KEY}` };

  for (let attempt = 1; attempt <= 30; attempt++) {
    await new Promise(r => setTimeout(r, attempt === 1 ? 5000 : 20000));
    const res = await fetch(url, { headers });

    if (res.status === 200) {
      const data = await res.json();
      console.log(`  완료: ${data.length.toLocaleString()}개 레코드 수신`);
      return data;
    }
    if (res.status === 500) {
      const txt = await res.text();
      if (txt.includes('Empty delivery')) {
        console.log(`  attempt ${attempt}: 아직 처리 중...`);
        continue;
      }
      throw new Error(`스냅샷 오류: ${txt}`);
    }
    console.log(`  attempt ${attempt}: HTTP ${res.status}`);
  }
  throw new Error('스냅샷 타임아웃 (10분 초과)');
}

// ─────────────────────────────────────────
// 3. 레코드 → Moss doc 변환
// ─────────────────────────────────────────
function toMossDoc(rec) {
  // Amazon 우선, Walmart 폴백
  const title    = rec.title_amazon       || rec.product_name_walmart || '';
  const brand    = rec.brand_amazon       || rec.brand_walmart        || '';
  const price    = rec.final_price_amazon ?? rec.final_price_walmart  ?? rec.initial_price_amazon ?? '';
  const currency = rec.currency_amazon    || rec.currency_walmart     || 'USD';
  const rating   = rec.rating_amazon      || rec.rating_walmart       || rec.rating_stars_walmart || '';
  const reviews  = rec.reviews_count_amazon ?? rec.review_count_walmart ?? '';
  const image    = rec.image_url_amazon   || (rec.image_urls_walmart || [])[0] || '';
  const urlAmz   = rec.url_amazon         || '';
  const urlWmt   = rec.url_walmart        || '';
  const asin     = rec.asin_amazon        || '';
  const dept     = rec.department_amazon  || rec.root_category_name_walmart || '';
  const avail    = rec.availability_amazon|| (rec.available_for_delivery_walmart ? 'In Stock' : '') || '';

  // categories: 첫 번째 path 배열을 문자열로
  const catAmz = (rec.categories_amazon  || []).map(p => Array.isArray(p) ? p.join(' > ') : p).join(' | ');
  const catWmt = (rec.categories_walmart || []).map(p => Array.isArray(p) ? p.join(' > ') : p).join(' | ');

  if (!title) return null;

  const id = asin || Buffer.from(urlAmz || urlWmt || title).toString('base64').slice(0, 32);
  const text = [title, brand, dept, catAmz || catWmt].filter(Boolean).join(' ');

  return {
    id,
    text,
    metadata: {
      title,
      brand,
      asin,
      url_amazon:  urlAmz,
      url_walmart: urlWmt,
      price:       price != null ? String(price) : '',
      currency,
      rating:      rating != null ? String(rating) : '',
      reviews_count: reviews != null ? String(reviews) : '',
      main_image:  image,
      availability: avail,
      department:  dept,
      categories_amazon:  catAmz,
      categories_walmart: catWmt,
    },
  };
}

// ─────────────────────────────────────────
// 4. Moss 업로드
// ─────────────────────────────────────────
async function uploadToMoss(docs) {
  console.log(`\n[3/4] Moss 업로드 (project: ${MOSS_ID})...`);
  const client = new MossClient(MOSS_ID, MOSS_KEY);

  // 기존 인덱스 확인
  let indexExists = false;
  try {
    await client.loadIndex(INDEX_NAME);
    indexExists = true;
    console.log(`  인덱스 '${INDEX_NAME}' 이미 존재 — addDocs 모드`);
  } catch {
    console.log(`  인덱스 '${INDEX_NAME}' 없음 — createIndex 모드`);
  }

  const total = docs.length;
  let uploaded = 0;

  if (!indexExists) {
    // 첫 번째 배치로 인덱스 생성
    const firstBatch = docs.slice(0, BATCH_SIZE);
    console.log(`  createIndex (첫 배치 ${firstBatch.length}개)...`);
    await client.createIndex(INDEX_NAME, firstBatch, { modelId: 'moss-minilm' });
    await client.loadIndex(INDEX_NAME);
    uploaded += firstBatch.length;
    docs = docs.slice(BATCH_SIZE);
  }

  // 나머지 배치 업로드
  const batches = Math.ceil(docs.length / BATCH_SIZE);
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    await client.addDocs(INDEX_NAME, batch, { upsert: true });
    uploaded += batch.length;
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    process.stdout.write(`\r  업로드: ${uploaded.toLocaleString()} / ${total.toLocaleString()} (배치 ${batchNum}/${batches})`);
  }
  console.log('\n  완료!');
}

// ─────────────────────────────────────────
// 메인
// ─────────────────────────────────────────
async function main() {
  console.log('=== Checky Food DB 세팅 ===');
  console.log(`Bright Data dataset: ${DATASET_ID}`);
  console.log(`Moss project: ${MOSS_ID}`);
  console.log(`목표: 음식 제품 ~${RECORDS_LIMIT.toLocaleString()}개 (reviews >= ${REVIEW_MIN})`);

  const snapshotId = await triggerFilter();
  const records = await downloadSnapshot(snapshotId);

  console.log(`\n[3/4] 변환 중...`);
  const docs = records.map(toMossDoc).filter(Boolean);
  console.log(`  유효 레코드: ${docs.length.toLocaleString()}개 (null 제외)`);

  // 중복 제거 (id 기준)
  const seen = new Set();
  const unique = docs.filter(d => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
  console.log(`  중복 제거 후: ${unique.length.toLocaleString()}개`);

  await uploadToMoss(unique);

  // 검증
  console.log(`\n[4/4] 검증...`);
  const client = new MossClient(MOSS_ID, MOSS_KEY);
  const info = await client.getIndex(INDEX_NAME);
  console.log(`  인덱스 상태: ${info.status}`);
  console.log(`  저장된 문서 수: ${info.docCount?.toLocaleString()}`);

  await client.loadIndex(INDEX_NAME);
  const test = await client.query(INDEX_NAME, 'apple juice', { topK: 3 });
  console.log(`\n  테스트 쿼리 'apple juice' → ${test.docs?.length}개 결과:`);
  for (const d of test.docs || []) {
    console.log(`    - ${d.metadata?.title?.slice(0, 60)} (score: ${d.score?.toFixed(3)})`);
  }

  console.log('\n✅ 완료!');
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message);
  process.exit(1);
});

import type { Page } from 'playwright';
import { findBestCandidate, extractEnglishName, authorsMatch } from './utils.js';

async function scrapeGoodreadsBookPage(page: Page) {
  const url = page.url();

  const data = await page.evaluate(() => {
    // 評分：CSS selector 優先，抓不到就用 regex 掃全頁文字
    const ratingEl = document.querySelector('div.RatingStatistics__rating');
    let rating: number | null = null;
    if (ratingEl) {
      rating = parseFloat(ratingEl.textContent?.trim() ?? '') || null;
    } else {
      const match = document.body.innerText.match(/(\d+\.\d+)\s*avg rating/);
      if (match) rating = parseFloat(match[1]!) || null;
    }

    // 評分人數：regex 掃全頁
    let ratingCount: number | null = null;
    const countMatch = document.body.innerText.match(/([\d,]+)\s*ratings?/);
    if (countMatch) ratingCount = parseInt(countMatch[1]!.replace(/,/g, ''), 10) || null;

    // 英文作者（順手抓，供 Amazon 搜尋使用）
    const enAuthor = document.querySelector('span.ContributorLink__name')?.textContent?.trim() ?? null;

    return { rating, ratingCount, enAuthor };
  });

  // 清洗 enAuthor，去除中文夾雜的部分
  return { ...data, enAuthor: extractEnglishName(data.enAuthor), url };
}

export async function scrapeGoodreads(
  page: Page,
  isbn: string,
  originalTitle: string | null,
  authorHint?: string | null, // Kobo 作者欄提取的英文名
) {
  // ISBN 直查時找到但無評分（中文版）時的備援結果（至少有 enAuthor 可用）
  let isbnFallback: Awaited<ReturnType<typeof scrapeGoodreadsBookPage>> | null = null;

  // --- 1. ISBN 直查（最精準）---
  if (isbn !== '-') {
    try {
      await page.goto(`https://www.goodreads.com/book/isbn/${isbn}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      // console.log(`  [GR] ISBN lookup 落地 URL: ${page.url()}`);
      // 成功會 redirect 到 /book/show/NNNNN.xxx
      if (page.url().includes('/book/show/')) {
        const result = await scrapeGoodreadsBookPage(page);
        if (authorHint && result.enAuthor && !authorsMatch(authorHint, result.enAuthor)) {
          // 作者不符，fall through 走搜尋
        } else if (result.rating === null && originalTitle) {
          // 有找到但無評分（通常是中文譯本頁）→ 存備援，改走原文搜尋
          isbnFallback = result;
        } else {
          return result;
        }
      }
    } catch {
      // timeout 或其他錯誤，繼續往下走搜尋
    }
  }

  // --- 2. 搜尋備援（需要 originalTitle）---
  if (!originalTitle) return isbnFallback;

  try {
    // authorHint 優先；fallback 到 isbnFallback.enAuthor（ISBN 版找到的作者，比純書名搜尋精準）
    const effectiveAuthor = authorHint ?? isbnFallback?.enAuthor ?? null;
    const query = effectiveAuthor ? `${originalTitle} ${effectiveAuthor}` : originalTitle;
    await page.goto(
      `https://www.goodreads.com/search?q=${encodeURIComponent(query)}&search_type=books`,
      { waitUntil: 'domcontentloaded', timeout: 30_000 },
    );
    // 搜尋結果是 JS 渲染的，等待第一個書本連結出現
    await page.waitForSelector('a[href*="/book/show/"]', { timeout: 10_000 }).catch(() => {});

    const candidates = await page.evaluate(() => {
      const seen = new Set<string>();
      return Array.from(document.querySelectorAll('a[href*="/book/show/"]'))
        .map(el => {
          const href = (el as HTMLAnchorElement).href.split('?')[0]!;
          const title =
            el.querySelector('span[itemprop="name"]')?.textContent?.trim() ||
            el.textContent?.trim() ||
            '';
          return { href, title };
        })
        .filter(c => {
          if (!c.title || seen.has(c.href)) return false;
          seen.add(c.href);
          return true;
        })
        .slice(0, 5);
    });

    // console.log(`  [GR] candidates (${candidates.length}筆):`, candidates.map(c => `"${c.title}"`).join(', '));
    const stripSub = (s: string) => s.replace(/\s*[:–—].*/, '').trim();
    const bestUrl = findBestCandidate(
      stripSub(originalTitle),
      candidates.map(c => ({ ...c, title: stripSub(c.title) })),
    );
    // console.log(`  [GR] bestUrl: ${bestUrl ?? 'null'}`);
    if (!bestUrl) return isbnFallback;

    await page.goto(bestUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    return await scrapeGoodreadsBookPage(page);
  } catch {
    return isbnFallback;
  }
}

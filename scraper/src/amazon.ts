import type { Page } from 'playwright';
import { findBestCandidate, sleep } from './utils.js';

export async function scrapeAmazon(
  page: Page,
  originalTitle: string,
  enAuthor: string | null,
) {
  const query = enAuthor ? `${originalTitle} ${enAuthor}` : originalTitle;

  try {
    // --- Step 1: 搜尋頁找最佳結果 ---
    await page.goto(
      `https://www.amazon.com/s?k=${encodeURIComponent(query)}&i=digital-text`,
      { waitUntil: 'load', timeout: 30_000 },
    );
    await sleep(2000 + Math.random() * 1000);
    await page.mouse.move(200 + Math.random() * 300, 200 + Math.random() * 300);
    await page.evaluate(() => window.scrollBy(0, 300));
    await sleep(1000 + Math.random() * 500);
    await page.waitForSelector('div[data-component-type="s-search-result"]', { timeout: 10_000 }).catch(() => {});
    // console.log(`  [AMZ] 落地 URL: ${page.url()}`);
    // console.log(`  [AMZ] component=${document.querySelectorAll('div[data-component-type="s-search-result"]').length}`);

    const results = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div[data-component-type="s-search-result"]'))
        .slice(0, 5)
        .map(el => {
          const title = el.querySelector('h2')?.getAttribute('aria-label')?.trim() ?? '';
          const rawHref = el.querySelector('a[href*="/dp/"]')?.getAttribute('href') ?? '';
          const asinMatch = rawHref.match(/\/dp\/([A-Z0-9]+)/);
          const href = asinMatch ? `https://www.amazon.com/dp/${asinMatch[1]!}` : '';
          return { href, title };
        })
        .filter(r => r.title.length > 0 && r.href.length > 0);
    });

    // 砍副標後再比對，避免 "Tell Me What You Want: A Therapist..." 因長副標稀釋分數
    const stripSubtitle = (s: string) => s.replace(/\s*[:–—].*/, '').trim();
    const bestUrl = findBestCandidate(
      stripSubtitle(originalTitle),
      results.map(r => ({ ...r, title: stripSubtitle(r.title) })),
    );
    if (!bestUrl) return null;

    // --- Step 2: 進商品頁取評分與精確數量 ---
    await page.goto(bestUrl, { waitUntil: 'load', timeout: 30_000 });
    await sleep(1500 + Math.random() * 1000);
    await page.mouse.move(200 + Math.random() * 300, 200 + Math.random() * 300);
    await page.evaluate(() => window.scrollBy(0, 300));
    await sleep(1000 + Math.random() * 500);

    const data = await page.evaluate(() => {
      // 評分："4.6 out of 5 stars" → 取最前面的數字
      const ratingText = document.querySelector('span[data-hook="rating-out-of-text"]')?.textContent ?? '';
      const ratingMatch = ratingText.match(/^([\d.]+)/);
      const rating = ratingMatch ? parseFloat(ratingMatch[1]!) : null;

      // 精確評分數："24,875 個全球評分" / "24,875 global ratings" → 24875
      const countText = document.querySelector('span[data-hook="total-review-count"]')?.textContent?.trim() ?? '';
      const countMatch = countText.match(/[\d,]+/);
      const ratingCount = countMatch ? parseInt(countMatch[0]!.replace(/,/g, ''), 10) || null : null;

      return { rating, ratingCount };
    });

    return { ...data, url: bestUrl };
  } catch {
    return null;
  }
}

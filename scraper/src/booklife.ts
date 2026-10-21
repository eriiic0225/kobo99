import type { Page } from 'playwright';
import { isBookMatched } from './utils.js';

//! --- 單獨測試博客來時用的程式碼
// import { chromium } from 'playwright-extra';
// import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// chromium.use(stealthPlugin());

// const TEST_TITLE = '萬事皆美好:讓無數希臘人感受幸福的禮物書';

// async function run() {
//   const browser = await chromium.launch({ headless: false });
//   const context = await browser.newContext({
//     locale: 'zh-TW',
//     timezoneId: 'Asia/Taipei',
//     userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
//     viewport: { width: 1280, height: 900 },
//   });
//   const page = await context.newPage();

//   try {
//     const productId = await scrapeBooksSearchPage(page, TEST_TITLE);
//     console.log('商品編號：', productId);
//     if (!productId) return;

//     const result = await scrapeBooksBookPage(page, productId);
//     console.log('博客來評分：', result?.booksRating);
//     console.log('博客來則數：', result?.booksRatingCount);
//     console.log('博客來 URL：', result?.booksUrl);
//   } finally {
//     await context.close();
//     await browser.close();
//     console.log('\n完成');
//   }
// }

// run().catch(err => { console.error(err); process.exit(1); });
// -------- block end -----------

export async function scrapeBooksSearchPage(page: Page, title: string): Promise<string | null> {

  const SEARCH_BASE = 'https://search.books.com.tw/search/query/key';

  // 回傳 null = 確定配不到；被擋或載入失敗則 throw，讓主流程記成 error 而非 not_found
  const searchTitle = title.replace(/\s*[：:].*/, '').trim();
  const url = `${SEARCH_BASE}/${encodeURIComponent(searchTitle)}/cat/EBA`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const status = response?.status();
  if (status === 404) return null;
  if (status !== undefined && status >= 400) throw new Error(`博客來搜尋頁回應 ${status}`);

  const html = await page.content();
  const isChallenge =
    html.includes('cf-browser-verification') ||
    html.includes('cf_chl_') ||
    html.includes('Just a moment') ||
    html.includes('Checking your browser');
  if (isChallenge) throw new Error('博客來搜尋頁被 Cloudflare 攔截');

  await page.waitForSelector('[id^="prod-itemlist-"]', { timeout: 10_000 }).catch(() => null);

  const first = await page.evaluate(() => {
    const el = document.querySelector('[id^="prod-itemlist-"]');
    if (!el) return null;
    return { id: el.id, title: el.querySelector('a[title]')?.getAttribute('title') ?? '' };
  });
  if (!first) return null;

  const resultTitle = first.title.replace(/\s*\(電子書\)$/, '').trim();
  if (!isBookMatched(searchTitle, resultTitle)) {
    const cleanResult = (resultTitle.split(/[：:—\-]/)[0] ?? '').replace(/\s+/g, '');
    console.log(`  ⚠️ 博客來配對不符：「${cleanResult}」`);
    return null;
  }

  return first.id.replace('prod-itemlist-', '');
}

export async function scrapeBooksBookPage(page: Page, productId: string) {

  const BOOK_BASE = 'https://www.books.com.tw/products';
  const booksUrl = `${BOOK_BASE}/${productId}`;
  try {
    await page.goto(booksUrl, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForSelector('em.ratingValue', { timeout: 15000 }).catch(() => null);

    const { booksRating, booksRatingCount } = await page.evaluate(() => {
      const ratingText = document.querySelector('em.ratingValue')?.textContent?.trim();
      const booksRating = ratingText !== undefined ? parseFloat(ratingText) : null;

      const countText = document.querySelector('a.btn-link')
        ?.textContent?.match(/\d+/)?.[0];
      const booksRatingCount = countText !== undefined ? parseInt(countText, 10) : null;

      return { booksRating, booksRatingCount };
    });

    return { booksRating, booksRatingCount, booksUrl };
  } catch(err) {
    console.error('博客來書頁抓取失敗', err);
    return null;
  }
}

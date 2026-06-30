import type { Page } from 'playwright';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { stringSimilarity } from 'string-similarity-js';

//! --- 單獨測試博客來時用的程式碼
// import { chromium } from 'playwright-extra';
// import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// chromium.use(stealthPlugin());

// const TEST_TITLE = '萬事皆美好:讓無數希臘人感受幸福的禮物書';

// async function run() {
//   const productId = await scrapeBooksSearchPage(TEST_TITLE);
//   console.log('商品編號：', productId);
//   if (!productId) return;

//   const browser = await chromium.launch({ headless: false });
//   const context = await browser.newContext({
//     locale: 'zh-TW',
//     timezoneId: 'Asia/Taipei',
//     userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
//     viewport: { width: 1280, height: 900 },
//   });
//   const page = await context.newPage();

//   try {
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

export async function scrapeBooksSearchPage(title: string): Promise<string | null> {

  const SEARCH_BASE = 'https://search.books.com.tw/search/query/key';

  const searchTitle = title.replace(/\s*[：:].*/, '').trim();
  try {
    const url = `${SEARCH_BASE}/${encodeURIComponent(searchTitle)}/cat/EBA`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 10_000,
    });
    const $ = cheerio.load(response.data);
    const first = $('[id^="prod-itemlist-"]').first();
    const idAttr = first.attr('id');
    if (!idAttr) return null;

    const resultTitle = first.find('a[title]').first().attr('title')
      ?.replace(/\s*\(電子書\)$/, '').trim() ?? '';
    const score = stringSimilarity(searchTitle, resultTitle);
    if (score < 0.3) {
      console.log(`  ⚠️ 博客來配對相似度過低 (${score.toFixed(2)})：「${resultTitle}」`);
      return null;
    }

    return idAttr.replace('prod-itemlist-', '');
  } catch(err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    console.error('博客來搜尋失敗', err);
    return null;
  }
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

import type { Page } from 'playwright';
import axios from 'axios';
import * as cheerio from 'cheerio';

//! --- 單獨測試博客來時用的程式碼
// import { chromium } from 'playwright-extra';
// import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// chromium.use(stealthPlugin());

// const TEST_TITLE = '瘋狂與深情：艾倫．瑞克曼日記絮語（「石內卜教授」唯一私人日記出版！一窺其螢光幕後最真實的日常）';

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

  try {
    const url = `${SEARCH_BASE}/${encodeURIComponent(title)}/cat/EBA`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      timeout: 10_000,
    });
    const $ = cheerio.load(response.data);
    const idAttr = $('[id^="prod-itemlist-"]').first().attr('id');
    if (!idAttr) return null;
    return idAttr.replace('prod-itemlist-', '');
  } catch(err) {
    console.error('博客來搜尋失敗', err);
    return null;
  }
}

export async function scrapeBooksBookPage(page: Page, productId: string) {

  const BOOK_BASE = 'https://www.books.com.tw/products';
  const booksUrl = `${BOOK_BASE}/${productId}`;
  try {
    await page.goto(booksUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

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

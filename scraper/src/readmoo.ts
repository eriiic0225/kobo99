import type { Page } from 'playwright';
import axios from 'axios';
import * as cheerio from 'cheerio';

//! --- 單獨測試讀墨時用的程式碼（需要獨立的 playwright）
// import { chromium } from 'playwright-extra';
// import stealthPlugin from 'puppeteer-extra-plugin-stealth';

// chromium.use(stealthPlugin());

// const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// const testISBN = "9789862626801"

// async function run(){
//   const browser = await chromium.launch({ 
//     headless: false, 
//   });
//   const context = await browser.newContext({
//     locale: 'zh-TW',
//     timezoneId: 'Asia/Taipei',
//     userAgent:
//       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
//     viewport: { width: 1280, height: 900 },
//   });

//   const page = await context.newPage();

//   try {
//     const readmooBookLink = await scrapeReadmooSearchPage(page, testISBN)
//     if (!readmooBookLink) return
//     const result = await scrapeReadmooBookPage(readmooBookLink, null);
//     if (!result) return
//     const { readmooRating, readmooRatingCount, ogPrice } = result
    
//     console.log("讀墨評分：  ", readmooRating)
//     console.log("讀墨評分數：", readmooRatingCount)
//     console.log("原價：     ", ogPrice)

//     return { readmooRating, readmooRatingCount, ogPrice }
//   } finally {
//     await context.close();
//     await browser.close();
//     console.log('\n完成');
//   }
// }

// run().catch(err => {
//   console.error(err);
//   process.exit(1);
// });

// -------- block end -----------


// https://readmoo.com/search/keyword?q=9789862626801&kw=9789862626801
const readmooURL = `https://readmoo.com/search/keyword?q=`

export async function scrapeReadmooSearchPage(page: Page, isbn: string) {
  await page.goto(
    `${readmooURL}${isbn}&kw=${isbn}`,
    { waitUntil: 'domcontentloaded', timeout: 30_000 }
  );
  await page.waitForSelector('a[data-readmoo-id]', { timeout: 10000 }).catch(() => null);
  await page.evaluate(() => window.scrollBy(0, 200));

  const html = await page.content();
  console.log(`  [readmoo debug] HTML 前 300 字：${html.slice(0, 300).replace(/\s+/g, ' ')}`);
  const isChallenge =
    html.includes('cf-browser-verification') ||
    html.includes('cf_chl_') ||
    html.includes('Just a moment') ||
    html.includes('Checking your browser');

  if (isChallenge) {
    throw new Error('讀墨搜尋頁被 Cloudflare 攔截，稍後重試');
  }

  const count = await page.locator('a[data-readmoo-id]').count();
  console.log(`  [readmoo debug] a[data-readmoo-id] 數量：${count}`);
  if (count === 0) return null;

  const readmooBookLink = await page.locator('a[data-readmoo-id]').first().getAttribute('href');
  return readmooBookLink;
}

export async function scrapeReadmooBookPage(url: string, originalPrice: number | null) {
  try{
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data)

    const readmooRating = $('div[itemprop="ratingValue"]').attr('data-score') ?? null
    const readmooRatingCountString =  $('span[itemprop="ratingCount"]').text()
    const readmooRatingCount = readmooRatingCountString
      ? parseInt(readmooRatingCountString, 10)
      : null;
    const ogPrice = (!originalPrice)
      ? parseInt($('strong[itemprop="price"]').text(), 10) || null
      : null
  
    return { readmooRating, readmooRatingCount, ogPrice, readmooUrl: url }
  } catch {
    console.error('讀墨書頁抓取失敗');
    return null;
  }
}
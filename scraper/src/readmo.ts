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
//     const readmoBookLink = await scrapeReadmoSearchPage(page, testISBN)
//     if (!readmoBookLink) return
//     const result = await scrapeReadmoBookPage(readmoBookLink, null);
//     if (!result) return
//     const { readmoRating, readmoRatingCount, ogPrice } = result
    
//     console.log("讀墨評分：  ", readmoRating)
//     console.log("讀墨評分數：", readmoRatingCount)
//     console.log("原價：     ", ogPrice)

//     return { readmoRating, readmoRatingCount, ogPrice }
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
const readmoURL = `https://readmoo.com/search/keyword?q=`

export async function scrapeReadmoSearchPage(page: Page, isbn: string) {
  await page.goto(
    `${readmoURL}${isbn}&kw=${isbn}`
    , { waitUntil: 'domcontentloaded', timeout: 30_000 }
  );

  const count = await page.locator('a[data-readmoo-id]').count(); // 找不到任何資訊就跳開
  if (count === 0) return null;

  const readmoBookLink = await page.locator('a[data-readmoo-id]').first().getAttribute('href');
  return readmoBookLink
}

export async function scrapeReadmoBookPage(url: string, originalPrice: number | null) {
  try{
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data)

    const readmoRating = $('div[itemprop="ratingValue"]').attr('data-score') ?? null
    const readmoRatingCountString =  $('span[itemprop="ratingCount"]').text()
    const readmoRatingCount = readmoRatingCountString
      ? parseInt(readmoRatingCountString, 10)
      : null;
    const ogPrice = (!originalPrice)
      ? parseInt($('strong[itemprop="price"]').text(), 10) || null
      : null
  
    return { readmoRating, readmoRatingCount, ogPrice, readmoURL: url }
  } catch {
    console.error('讀墨書頁抓取失敗');
    return null;
  }
}
import { scrapeKoboBookPage } from "./scrape.js";
import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(stealthPlugin());

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const testURL = "https://www.kobo.com/tw/zh/ebook/XdoFPpDrzjy_Z8NRDS4eYA"

async function run(){
  const browser = await chromium.launch({ 
    headless: false, 
  });
  const context = await browser.newContext({
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    const book = await scrapeKoboBookPage(page, testURL);
    console.log(`  書名：${book.title}`);
    console.log(`  原文：${book.originalTitle ?? '—'}`);
    console.log(`  作者：${book.author}`);
    console.log(`  原價：${book.originalPrice}`);
    console.log(`  ISBN：${book.isbn}\n`);

  } finally {
    await context.close();
    await browser.close();
    console.log('\n完成');
  }

}

run().catch(err => { console.error(err); process.exit(1); });
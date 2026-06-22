import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Page } from 'playwright';
import { scrapeReadmoSearchPage, scrapeReadmoBookPage } from './readmo.js';

// 告訴 Playwright 啟用 Stealth 插件
chromium.use(stealthPlugin());

const BLOG_URL = 'https://www.kobo.com/zh/blog/weekly-dd99-2026-w25';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeKoboBookPage(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await sleep(1500 + Math.random() * 1000);

  return page.evaluate(() => {
    const title = document.querySelector('.title.product-field')?.textContent?.trim() ?? '';
    const originalTitle = document.querySelector('.subtitle.product-field')?.textContent?.trim() ?? null;
    const author = document.querySelector('.contributor-name')?.textContent?.trim() ?? '';
    const coverUrl = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? '';

    const rawPrice = document.querySelector<HTMLMetaElement>('meta[property="og:price"]')?.content ?? '';
    const parsedPrice = rawPrice ? Math.round(parseFloat(rawPrice)) : null;
    const originalPrice = parsedPrice !== null && parsedPrice > 99 ? parsedPrice : null;

    const ratingLabel = document.querySelector('ul.stars.read-only')?.getAttribute('aria-label') ?? '';
    const ratingMatch = ratingLabel.match(/Rated ([\d.]+) out of 5 stars with (\d+)/);
    const koboRating = ratingMatch ? parseFloat(ratingMatch[1] ?? '0') : null;
    const koboRatingCount = ratingMatch ? parseInt(ratingMatch[2] ?? '0', 10) : null;

    const metadataBlock = Array.from(
      document.querySelector('.bookitem-secondary-metadata')?.querySelectorAll('li') ?? []
    );
    const isbnBlock = metadataBlock.find(li => li.textContent?.trim().startsWith('書籍ID：'));
    const isbn = isbnBlock?.querySelector('span')?.textContent.replace(/-/g, '').trim() ?? '-'

    return { title, originalTitle, author, coverUrl, originalPrice, koboRating, koboRatingCount, isbn };
  });
}

async function main() {
  console.log('🚀 Kobo Blog 測試開始');
  console.log(`   URL: ${BLOG_URL}\n`);

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
    await page.goto(BLOG_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await sleep(2000 + Math.random() * 2000); // 隨機等待，增加抗性

    const html = await page.content();

    const isChallenge =
      html.includes('cf-browser-verification') ||
      html.includes('cf_chl_') ||
      html.includes('Just a moment') ||
      html.includes('Checking your browser');

    console.log(`頁面狀態：${isChallenge ? '⚠️  Cloudflare 挑戰頁' : '✅ 真實內容'}`);
    console.log(`HTML 大小：${(html.length / 1024).toFixed(0)} KB\n`);

    if (!isChallenge) {
      const entries = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('div.book-block')).map(block => {
          const linkEl = block.querySelector('a[href*="/ebook/"]') as HTMLAnchorElement | null;
          const url = linkEl?.href.split('?')[0] ?? '';

          const contentBlock = block.previousElementSibling;
          const strong = contentBlock?.querySelector('h3 strong');
          const dateMatch = strong?.textContent?.match(/(\d+\/\d+)/);
          const date = dateMatch?.[1] ?? '';

          const descriptionEl = contentBlock?.querySelector('p');
          const description = descriptionEl?.textContent?.trim() ?? '';

          return { date, url, description };
        });
      });

      console.log(`找到 ${entries.length} 筆，開始逐一抓書頁...\n`);

      for (const [i, e] of entries.entries()) {
        console.log(`[${i + 1}/${entries.length}] ${e.date}  ${e.url}`);
        const book = await scrapeKoboBookPage(page, e.url);

        const readmooLink = book.isbn !== '-'
          ? await scrapeReadmoSearchPage(page, book.isbn)
          : null;
        const readmoo = readmooLink
          ? await scrapeReadmoBookPage(readmooLink, book.originalPrice)
          : null;

        const finalPrice = book.originalPrice ?? readmoo?.ogPrice ?? null;

        console.log(`  書名：${book.title}`);
        console.log(`  原文：${book.originalTitle ?? '—'}`);
        console.log(`  作者：${book.author}`);
        console.log(`  原價：${finalPrice ? `NT$${finalPrice}` : '—'}`);
        console.log(`  Kobo 評分：${book.koboRating ?? '—'}（${book.koboRatingCount ?? 0} 則）`);
        console.log(`  讀墨評分：${readmoo?.readmoRating ?? '—'}（${readmoo?.readmoRatingCount ?? 0} 則）`);
        console.log(`  簡介：${e.description.slice(0, 60)}...`);
        console.log(`  ISBN：${book.isbn}\n`);
      }
    }

  } finally {
    await context.close();
    await browser.close();
    console.log('\n完成');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

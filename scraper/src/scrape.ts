import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { errors, type Page } from 'playwright';
import { getISOWeek, getISOWeekYear } from 'date-fns';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { scrapeReadmooSearchPage, scrapeReadmooBookPage } from './readmoo.js';
import { scrapeBooksSearchPage, scrapeBooksBookPage } from './booklife.js';
import { scrapeGoodreads } from './goodreads.js';
import { scrapeAmazon } from './amazon.js';
import { mergeWeek } from './merge.js';
import { sleep, isEnglishBook, extractEnglishName } from './utils.js';
import type { Book, WeekEntry, ScrapeStatusValue } from './types.js';

// 告訴 Playwright 啟用 Stealth 插件
chromium.use(stealthPlugin());

// --- 週次計算（環境變數可覆蓋，用於補抓歷史資料）---
const now = new Date();
const week = process.env.TARGET_WEEK ? parseInt(process.env.TARGET_WEEK) : getISOWeek(now);
const year = process.env.TARGET_YEAR ? parseInt(process.env.TARGET_YEAR) : getISOWeekYear(now);
const BLOG_URL = `https://www.kobo.com/zh/blog/weekly-dd99-${year}-w${week}`;

export async function scrapeKoboBookPage(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  } catch (e) {
    if (!(e instanceof errors.TimeoutError)) throw e;
  }
  await page.waitForTimeout(2000);
  await page.mouse.move(200 + Math.random() * 300, 200 + Math.random() * 300);
  await page.evaluate(() => window.scrollBy(0, 300));
  await sleep(1500 + Math.random() * 1000);

  return page.evaluate(() => {
    const title = document.querySelector('.title.product-field')?.textContent?.trim() ?? '';
    const originalTitle = document.querySelector('.subtitle.product-field')?.textContent?.trim() ?? null;
    const author = document.querySelector('.contributor-name')?.textContent?.trim() ?? '';
    const coverUrl = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? '';

    const metaPriceStr = document.querySelector<HTMLMetaElement>('meta[property="og:price"]')?.content ?? '';
    const currentPrice = metaPriceStr ? Math.round(parseFloat(metaPriceStr)) : 0;

    const strikethroughText = document.querySelector('span.price.strikethrough')
      ?.textContent?.replace('NT$', '').replace(/,/g, '').trim();
    const strikethroughPrice = strikethroughText ? parseInt(strikethroughText, 10) || null : null;

    const originalPrice = strikethroughPrice ?? (currentPrice > 99 ? currentPrice : null);

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
  console.log('🚀 Kobo Blog 爬蟲開始');
  console.log(`   URL: ${BLOG_URL}\n`);

  const browser = await chromium.launch({ 
    headless: false, 
  });
  const context = await browser.newContext({
    locale: 'zh-TW',
    extraHTTPHeaders: {
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7' 
    },
    timezoneId: 'Asia/Taipei',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    try {
      await page.goto(BLOG_URL, { waitUntil: 'networkidle', timeout: 60_000 });
    } catch (e){
      // 頁面可能已 render，背景請求未完成導致 timeout，繼續往下判斷
      if (!(e instanceof errors.TimeoutError)) throw e;
    }
    await sleep(2000 + Math.random() * 2000); // 隨機等待，增加抗性

    const html = await page.content();

    const isChallenge =
      html.includes('cf-browser-verification') ||
      html.includes('cf_chl_') ||
      html.includes('Just a moment') ||
      html.includes('Checking your browser');

    console.log(`頁面狀態：${isChallenge ? '⚠️  Cloudflare 挑戰頁' : '✅ 真實內容'}`);
    console.log(`HTML 大小：${(html.length / 1024).toFixed(0)} KB\n`);

    if (isChallenge) {
      throw new Error('Kobo blog 被 Cloudflare 攔截，稍後重試');
    }

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

      const weekBooks: Book[] = [];

      for (const [i, e] of entries.entries()) {
        console.log(`[${i + 1}/${entries.length}] ${e.date}  ${e.url}`);

        // Kobo 個別書籍頁面
        const book = await scrapeKoboBookPage(page, e.url);
        const koboStatus: ScrapeStatusValue = book.title ? 'ok' : 'error';

        // 抓讀墨
        const readmooSkipped = book.isbn === '-';
        const readmooLink = !readmooSkipped
          ? await scrapeReadmooSearchPage(page, book.isbn)
          : null;
        const readmoo = readmooLink
          ? await scrapeReadmooBookPage(readmooLink, book.originalPrice)
          : null;
        let readmooStatus: 'skipped' | 'not_found' | 'error' | 'ok';
        if (readmooSkipped)       readmooStatus = 'skipped';
        else if (!readmooLink)    readmooStatus = 'not_found';
        else if (!readmoo)        readmooStatus = 'error';
        else                      readmooStatus = 'ok';

        // 抓博客來（非 978 開頭 = 中國大陸出版，博客來無電子版，跳過）
        const booksSkipped = !book.isbn.startsWith('978');
        const booksProdId = !booksSkipped
          ? await scrapeBooksSearchPage(book.title)
          : null;
        const books = booksProdId
          ? await scrapeBooksBookPage(page, booksProdId)
          : null;

        let booksStatus: 'skipped' | 'not_found' | 'error' | 'ok';
        if (booksSkipped)         booksStatus = 'skipped';
        else if (!booksProdId)    booksStatus = 'not_found';
        else if (!books)          booksStatus = 'error';
        else                      booksStatus = 'ok';

        // 從 Kobo 作者欄提取英文名（如 "史戴凡諾斯（Stefanos Xenakis）" → "Stefanos Xenakis"）
        const koboEnAuthor = extractEnglishName(book.author);

        // 抓 Goodreads（所有書都試；authorHint 用於驗證 ISBN 結果 & 強化搜尋精準度）
        const goodreads = await scrapeGoodreads(page, book.isbn, book.originalTitle, koboEnAuthor);
        const goodreadsStatus: ScrapeStatusValue = goodreads ? 'ok' : 'not_found';

        // 抓 Amazon（英文書才抓；enAuthor 從 Goodreads 順手帶入提升精準度）
        const amazonSkipped = !isEnglishBook(book.originalTitle);
        const amazon = !amazonSkipped
          ? await scrapeAmazon(page, book.originalTitle!, goodreads?.enAuthor ?? null)
          : null;
        const amazonStatus: ScrapeStatusValue = amazonSkipped ? 'skipped'
          : amazon ? 'ok' : 'not_found';

        const scrapeStatus = {
          kobo: koboStatus,
          readmoo: readmooStatus,
          books: booksStatus,
          goodreads: goodreadsStatus,
          amazon: amazonStatus,
        };
        const originalPrice = book.originalPrice ?? readmoo?.ogPrice ?? null;

        console.log(`  書名：${book.title}`);
        console.log(`  原文：${book.originalTitle ?? '—'}`);
        console.log(`  作者：${book.author}`);
        console.log(`  原價：${originalPrice ? `NT$${originalPrice}` : '—'}`);
        console.log(`  Kobo 評分：${book.koboRating ?? '—'}（${book.koboRatingCount ?? 0} 則）`);
        console.log(`  讀墨評分：${readmoo?.readmooRating ?? '—'}（${readmoo?.readmooRatingCount ?? 0} 則）`);
        console.log(`  博客來評分：${books?.booksRating ?? '—'}（${books?.booksRatingCount ?? 0} 則）`);
        console.log(`  Goodreads：${goodreads?.rating ?? '—'}（${goodreads?.ratingCount ?? 0} 則）${goodreads?.enAuthor ? ` · ${goodreads.enAuthor}` : ''}`);
        console.log(`  Amazon：${amazon?.rating ?? '—'}（${amazon?.ratingCount ?? 0} 則）`);
        console.log(`  簡介：${e.description.slice(0, 60)}...`);
        console.log(`  ISBN：${book.isbn}`);
        console.log(`  狀態：Kobo=${scrapeStatus.kobo} 讀墨=${scrapeStatus.readmoo} 博客來=${scrapeStatus.books} GR=${scrapeStatus.goodreads} AMZ=${scrapeStatus.amazon}\n`);

        const readmooData = readmoo
          ? {
              rating: readmoo.readmooRating != null ? parseFloat(readmoo.readmooRating) : null,
              ratingCount: readmoo.readmooRatingCount,
              url: readmoo.readmooUrl,
            }
          : null;
        const booksData = books
          ? { rating: books.booksRating, ratingCount: books.booksRatingCount, url: books.booksUrl }
          : null;

        weekBooks.push({
          date: e.date,
          title: book.title,
          originalTitle: book.originalTitle,
          author: book.author,
          description: e.description,
          url: e.url,
          coverUrl: book.coverUrl,
          originalPrice,
          koboRating: book.koboRating,
          koboRatingCount: book.koboRatingCount,
          isbn: book.isbn,
          readmoo: readmooData,
          books: booksData,
          goodreads: goodreads
            ? { rating: goodreads.rating, ratingCount: goodreads.ratingCount, url: goodreads.url, enAuthor: goodreads.enAuthor }
            : null,
          amazon: amazon
            ? { rating: amazon.rating, ratingCount: amazon.ratingCount, url: amazon.url }
            : null,
          scrapeStatus,
        });
      }

      // --- JSON 寫入 ---
      const __filename = fileURLToPath(import.meta.url);
      const dataPath = path.resolve(path.dirname(__filename), '../../data', `${year}-kobo99-deals.json`);
      let existing: WeekEntry[] = [];
      if (fs.existsSync(dataPath)) {
        existing = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as WeekEntry[];
      }
      const updated = mergeWeek(existing, week, weekBooks);
      updated.sort((a, b) => b.week - a.week);
      fs.mkdirSync(path.dirname(dataPath), { recursive: true });
      fs.writeFileSync(dataPath, JSON.stringify(updated, null, 2), 'utf-8');
      console.log(`\n✅ 寫入 ${dataPath}（第 ${week} 週，共 ${weekBooks.length} 本）`);
    }

  } finally {
    await context.close();
    await browser.close();
    console.log('\n完成');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

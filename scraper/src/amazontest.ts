import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { scrapeAmazon } from './amazon.js';
import { isEnglishBook } from './utils.js';

chromium.use(stealthPlugin());

const testBooks = [
  {
    label: '美好人生',
    originalTitle: 'THE GOOD LIFE: Lessons from the World\'s Longest Scientific Study of Happiness',
    enAuthor: 'Robert Waldinger',
  },
  {
    label: '解決問題的人',
    originalTitle: 'See, Solve, Scale: How Anyone Can Turn an Unsolved Problem into a Breakthrough Success',
    enAuthor: 'Danny Warshay',
  },
  {
    label: '伊甸園東',
    originalTitle: 'East of Eden',
    enAuthor: 'John Steinbeck',
  },
];

async function run() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    for (const [i, book] of testBooks.entries()) {
      console.log(`\n[${i + 1}/${testBooks.length}] ${book.label}`);
      console.log(`  原文書名: ${book.originalTitle}`);
      console.log(`  英文作者: ${book.enAuthor}`);
      console.log(`  isEnglish: ${isEnglishBook(book.originalTitle)}`);

      const result = await scrapeAmazon(page, book.originalTitle, book.enAuthor);

      if (!result) {
        console.log('  ❌ 找不到');
        continue;
      }

      console.log(`  ✅ URL: ${result.url}`);
      console.log(`  評分: ${result.rating ?? '—'}（${result.ratingCount ?? 0} 則）`);
    }
  } finally {
    await context.close();
    await browser.close();
    console.log('\n完成');
  }
}

run().catch(err => { console.error(err); process.exit(1); });

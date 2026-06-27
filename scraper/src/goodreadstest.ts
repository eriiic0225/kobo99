import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { scrapeGoodreads } from './goodreads.js';

chromium.use(stealthPlugin());

const testBooks = [
  {
    label: '美好人生（ISBN 直查）',
    isbn: '9789863989028',
    originalTitle: 'THE GOOD LIFE: Lessons from the World\'s Longest Scientific Study of Happiness',
  },
  {
    label: '解決問題的人（ISBN 直查）',
    isbn: '9786267181775',
    originalTitle: 'See, Solve, Scale: How Anyone Can Turn an Unsolved Problem into a Breakthrough Success',
  },
  {
    label: '伊甸園東（ISBN 直查）',
    isbn: '9786269764051',
    originalTitle: 'East of Eden',
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
      console.log(`  ISBN: ${book.isbn}`);
      console.log(`  原文書名: ${book.originalTitle}`);

      const result = await scrapeGoodreads(page, book.isbn, book.originalTitle);

      if (!result) {
        console.log('  ❌ 找不到');
        continue;
      }

      console.log(`  ✅ URL: ${result.url}`);
      console.log(`  評分: ${result.rating ?? '—'}（${result.ratingCount ?? 0} 則）`);
      console.log(`  英文作者: ${result.enAuthor ?? '—'}`);
    }
  } finally {
    await context.close();
    await browser.close();
    console.log('\n完成');
  }
}

run().catch(err => { console.error(err); process.exit(1); });

import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { scrapeGoodreads } from './goodreads.js';

chromium.use(stealthPlugin());

const testBooks = [
  {
    label: '萬事皆美好 — authorHint 驗證（Stefanos Xenakis，之前曾配錯書）',
    isbn: '9789861338033',
    originalTitle: 'The Gift',
    authorHint: 'Stefanos Xenakis',
  },
  {
    label: '世界冠軍紙飛機 — ratings 單數 fix（只有 1 則時應顯示正確 count）',
    isbn: '9789865562427',
    originalTitle: 'The New World Champion Paper Airplane Book: Featuring the World Record-Breaking Design, with Tear-Out Planes to Fold and Fly',
    authorHint: null,  // "約翰‧柯林斯" 無英文
  },
  {
    label: '我們想要什麼 — ISBN 打到中文版無評分，應 fallback 搜尋英文版',
    isbn: '9786263497726',
    originalTitle: 'What We Want',
    authorHint: null,  // "夏洛特．福斯．韋伯" 無英文
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

      const result = await scrapeGoodreads(page, book.isbn, book.originalTitle, book.authorHint);

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

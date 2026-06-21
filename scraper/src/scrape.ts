import { chromium } from 'playwright';

const BLOG_URL = 'https://www.kobo.com/zh/blog/weekly-dd99-2026-w25';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Kobo Blog 測試開始');
  console.log(`   URL: ${BLOG_URL}\n`);

  const browser = await chromium.launch({ 
    headless: false, 
    args: ['--disable-blink-features=AutomationControlled'] 
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
      const books = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('div.book-block')).map(block => {
          const titleEl = block.querySelector('.title');
          const authorEl = block.querySelector('.author');
          const linkEl = block.querySelector('a[href*="/ebook/"]') as HTMLAnchorElement | null;
          const imgEl = block.querySelector('img');

          const title = titleEl?.textContent?.trim().replace(/^《|》$/g, '') ?? '';
          const author = authorEl?.textContent?.trim().replace(/^由\s*/, '').replace(/＠著$/, '').trim() ?? '';
          const url = linkEl?.href.split('?')[0] ?? '';
          const coverUrl = imgEl?.src ?? '';

          // 日期：從前一個 div.content-block 裡的 h3 strong 抓
          const contentBlock = block.previousElementSibling;
          const strong = contentBlock?.querySelector('h3 strong');
          const dateMatch = strong?.textContent?.match(/(\d+\/\d+)/);
          const date = dateMatch?.[1] ?? '';

          return { title, author, url, coverUrl, date };
        });
      });

      console.log(`找到 ${books.length} 本書：`);
      for (const [i, b] of books.entries()) {
        console.log(`\n  ${i + 1}. ${b.date} 《${b.title}》`);
        console.log(`     作者：${b.author}`);
        console.log(`     URL：${b.url}`);
        console.log(`     封面：${b.coverUrl.slice(0, 70)}...`);
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

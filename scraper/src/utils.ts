import { stringSimilarity } from 'string-similarity-js';

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function isEnglishBook(originalTitle: string | null): boolean {
  return originalTitle != null && /[A-Za-z]/.test(originalTitle);
}

/**
 * 從姓名字串中提取英文部分
 * - "史戴凡諾斯（Stefanos Xenakis）" → "Stefanos Xenakis"
 * - "夏洛特 (Charlotte Fox Weber)" → "Charlotte Fox Weber"
 * - "John Steinbeck" → "John Steinbeck"（已是英文，直接回傳）
 * - "丹尼．沃謝" → null（無英文）
 */
export function extractEnglishName(name: string | null): string | null {
  if (!name) return null;

  // 優先從括號（半形或全形）中提取
  const parenMatch = name.match(/[（(]([^）)]+)/);
  if (parenMatch?.[1]) {
    const content = parenMatch[1].trim();
    // 只保留沒有 CJK 字元且含英文字母的內容
    if (/[A-Za-z]/.test(content) && !/[一-鿿぀-ゟ゠-ヿ]/.test(content)) {
      return content;
    }
  }

  // 無括號，整串都是英文
  if (/[A-Za-z]/.test(name) && !/[一-鿿぀-ゟ゠-ヿ]/.test(name)) {
    return name.trim();
  }

  return null;
}

export function authorsMatch(a: string, b: string): boolean {
  const words = a.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const bLower = b.toLowerCase();
  return words.some(w => bLower.includes(w));
}

export interface Candidate {
  href: string;
  title: string;
}

/**
 * 拿目標書名去跟搜尋結果列表做相似度比對，挑出最完美的連結
 * @param targetTitle 原文書名
 * @param candidates 搜尋結果頁面抓到的 { title, href } 陣列
 * @param threshold 相似度門檻 (低於此分數代表完全不沾邊，不採用)
 */
export function findBestCandidate(targetTitle: string, candidates: Candidate[], threshold = 0.4): string | null {
  if (candidates.length === 0) return null;

  let bestHref: string | null = null;
  let bestScore = 0;

  for (const item of candidates) {
    const score = stringSimilarity(targetTitle, item.title);
    if (score > bestScore) {
      bestScore = score;
      bestHref = item.href;
    }
  }

  if (bestScore < threshold) {
    console.log(`⚠️ 相似度過低 (${bestScore.toFixed(2)})，判定無相符書籍`);
    return null;
  }

  return bestHref;
}

import type { ScrapeStatusValue, Book, WeekEntry } from './types.js';

export type { ScrapeStatusValue, Book, WeekEntry };

const STATUS_PRIORITY: Record<ScrapeStatusValue, number> = { manual:5, ok: 4, skipped: 3, not_found: 2, error: 1 };

function mergeStatus(a: ScrapeStatusValue, b: ScrapeStatusValue): ScrapeStatusValue {
  return STATUS_PRIORITY[a] >= STATUS_PRIORITY[b] ? a : b;
}

export function mergeBook(oldBook: Book, newBook: Book): Book {
  return {
    date: oldBook.date ?? newBook.date,
    title: oldBook.title ?? newBook.title,
    originalTitle: oldBook.originalTitle ?? newBook.originalTitle,
    author: oldBook.author ?? newBook.author,
    description: oldBook.description ?? newBook.description,
    url: oldBook.url,
    coverUrl: oldBook.coverUrl ?? newBook.coverUrl,
    originalPrice: oldBook.originalPrice ?? newBook.originalPrice,
    koboRating: oldBook.koboRating ?? newBook.koboRating,
    koboRatingCount: oldBook.koboRatingCount ?? newBook.koboRatingCount,
    isbn: oldBook.isbn ?? newBook.isbn,
    readmoo: oldBook.readmoo ?? newBook.readmoo,
    books: oldBook.books ?? newBook.books,
    goodreads: oldBook.goodreads ?? newBook.goodreads,
    amazon: oldBook.amazon ?? newBook.amazon,
    scrapeStatus: {
      kobo: mergeStatus(oldBook.scrapeStatus.kobo, newBook.scrapeStatus.kobo),
      readmoo: mergeStatus(oldBook.scrapeStatus.readmoo, newBook.scrapeStatus.readmoo),
      books: mergeStatus(oldBook.scrapeStatus.books, newBook.scrapeStatus.books),
      goodreads: mergeStatus(oldBook.scrapeStatus.goodreads, newBook.scrapeStatus.goodreads),
      amazon: mergeStatus(oldBook.scrapeStatus.amazon, newBook.scrapeStatus.amazon),
    },
  };
}

export function mergeWeek(existing: WeekEntry[], week: number, newBooks: Book[]): WeekEntry[] {
  const existingIdx = existing.findIndex(e => e.week === week);

  if (existingIdx === -1) {
    return [{ week, books: newBooks }, ...existing];
  }

  const existingBooks = existing[existingIdx]!.books;
  const mergedBooks = newBooks.map(newBook => {
    const oldBook = existingBooks.find(b => b.url === newBook.url);
    return oldBook ? mergeBook(oldBook, newBook) : newBook;
  });

  // 本次 run 沒抓到但舊資料有的書（邊緣案例）
  const newUrls = new Set(newBooks.map(b => b.url));
  const orphaned = existingBooks.filter(b => !newUrls.has(b.url));

  const result = [...existing];
  result[existingIdx] = { week, books: [...mergedBooks, ...orphaned] };
  return result;
}

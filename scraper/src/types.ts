export type ScrapeStatusValue = 'ok' | 'skipped' | 'not_found' | 'error' | 'manual';

export type Book = {
  date: string;
  title: string;
  originalTitle: string | null;
  author: string;
  description: string;
  url: string;
  coverUrl: string;
  originalPrice: number | null;
  koboRating: number | null;
  koboRatingCount: number | null;
  isbn: string;
  readmoo: { rating: number | null; ratingCount: number | null; url: string } | null;
  books: { rating: number | null; ratingCount: number | null; url: string } | null;
  goodreads: { rating: number | null; ratingCount: number | null; url: string; enAuthor: string | null } | null;
  amazon: { rating: number | null; ratingCount: number | null; url: string } | null;
  scrapeStatus: {
    kobo: ScrapeStatusValue;
    readmoo: ScrapeStatusValue;
    books: ScrapeStatusValue;
    goodreads: ScrapeStatusValue;
    amazon: ScrapeStatusValue;
  };
};

export type WeekEntry = { week: number; books: Book[] };

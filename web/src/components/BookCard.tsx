import { useState } from 'react'
import { Star, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import type { Book } from '../types'
import { computeWeightedRating } from '../utils/rating'
import RatingChip from './RatingChip'

const DAYS = ['日', '一', '二', '三', '四', '五', '六']

function saleDateLabel(dateStr: string, year: number): string {
  const [m, d] = dateStr.split('/').map(Number)
  const dow = new Date(year, m - 1, d).getDay()
  return `${dateStr}（週${DAYS[dow]}）`
}

type Props = { book: Book; year: number }

function isToday(dateStr: string, year: number): boolean {
  const [m, d] = dateStr.split('/').map(Number)
  const now = new Date()
  return now.getFullYear() === year && now.getMonth() + 1 === m && now.getDate() === d
}

export default function BookCard({ book, year }: Props) {
  const [expanded, setExpanded] = useState(false)
  const todayDeal = isToday(book.date, year)
  const weighted = computeWeightedRating([
    book.koboRating != null ? { rating: book.koboRating, ratingCount: book.koboRatingCount } : null,
    book.readmoo,
    book.books,
    book.goodreads,
    book.amazon,
  ])

  const chips = [
    book.koboRating != null && book.url
      ? { platform: 'Kobo', rating: book.koboRating, count: book.koboRatingCount, url: book.url }
      : null,
    book.readmoo?.rating != null
      ? { platform: '讀墨', rating: book.readmoo.rating, count: book.readmoo.ratingCount, url: book.readmoo.url }
      : null,
    book.books?.rating != null
      ? { platform: '博客來', rating: book.books.rating, count: book.books.ratingCount, url: book.books.url }
      : null,
    book.goodreads?.rating != null
      ? { platform: 'Goodreads', rating: book.goodreads.rating, count: book.goodreads.ratingCount, url: book.goodreads.url }
      : null,
    book.amazon?.rating != null
      ? { platform: 'Amazon', rating: book.amazon.rating, count: book.amazon.ratingCount, url: book.amazon.url }
      : null,
  ].filter(Boolean) as { platform: string; rating: number; count: number | null; url: string }[]

  return (
    <article className="relative bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#000] transition-all duration-200 flex flex-col">
      {/* Today sticker */}
      {todayDeal && (
        <div className="absolute -top-3 -right-4 rotate-12 bg-neo-accent border-4 border-black shadow-[4px_4px_0px_0px_#000] px-3 py-1 z-20">
          <span className="font-black text-xs text-black uppercase tracking-widest">TODAY</span>
        </div>
      )}

      {/* Main row: cover + info */}
      <div className="flex flex-1">
        {/* Cover */}
        <a
          href={book.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 w-36 md:w-48 border-r-4 border-black self-stretch relative overflow-hidden"
          aria-label={`前往 Kobo 查看《${book.title}》`}
        >
          <img
            src={book.coverUrl}
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover scale-125 blur-xl opacity-70"
          />
          <img
            src={book.coverUrl}
            alt={`《${book.title}》封面`}
            className="relative w-full h-full object-contain z-10"
          />
        </a>

        {/* Info */}
        <div className="flex flex-col gap-3 p-4 flex-1 min-w-0">
          {/* Date */}
          <div className="inline-flex">
            <span className="bg-neo-secondary border-2 border-black px-2 py-0.5 font-bold text-xs tracking-wide">
              {saleDateLabel(book.date, year)}
            </span>
          </div>

          {/* Title & author */}
          <div>
            <h2 className="font-black text-base leading-tight line-clamp-3 text-black">
              {book.title}
            </h2>
            {book.originalTitle && (
              <p className="font-medium text-sm italic opacity-40 mt-0.5 line-clamp-1">
                {book.originalTitle}
              </p>
            )}
            <p className="font-bold text-sm mt-1 opacity-60">{book.author}</p>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="font-black text-xl text-neo-accent">NT$99</span>
            {book.originalPrice != null && (
              <span className="text-sm font-bold opacity-40 line-through">
                原價 NT${book.originalPrice}
              </span>
            )}
          </div>

          {/* Weighted score */}
          {weighted != null && (
            <div className="flex items-center gap-1.5 border-t-2 border-black pt-3">
              <Star className="w-5 h-5 fill-neo-secondary stroke-black" strokeWidth={2} />
              <span className="font-black text-3xl leading-none">{weighted.toFixed(2)}</span>
              <span className="text-xs font-bold opacity-50 mt-1">綜合評分</span>
            </div>
          )}

          {/* Platform chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <RatingChip key={c.platform} {...c} />
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="mt-auto pt-2">
            <a
              href={book.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-neo-accent border-4 border-black shadow-[4px_4px_0px_0px_#000] font-bold text-sm uppercase tracking-wide text-black hover:bg-red-400 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-100"
            >
              前往 Kobo
              <ExternalLink className="w-4 h-4" strokeWidth={3} />
            </a>
          </div>
        </div>
      </div>

      {/* Description section */}
      {book.description && (
        <div className="border-t-4 border-black px-4 pt-3 pb-3">
          <p className={`text-sm leading-relaxed opacity-70 ${expanded ? '' : 'line-clamp-2'}`}>
            {book.description}
          </p>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-2 inline-flex items-center gap-1 border-2 border-black px-2 py-0.5 text-xs font-bold uppercase tracking-wide hover:bg-black hover:text-white transition-colors duration-100"
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" strokeWidth={3} />收起</>
              : <><ChevronDown className="w-3 h-3" strokeWidth={3} />顯示簡介</>
            }
          </button>
        </div>
      )}
    </article>
  )
}

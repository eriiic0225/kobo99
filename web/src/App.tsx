import type { WeekEntry } from './types'
import dealsJson from '../../data/2026-kobo99-deals.json'
import BookCard from './components/BookCard'

const deals = dealsJson as unknown as WeekEntry[]

export default function App() {
  const latest = deals[0]
  const firstDate = latest.books[0]?.date ?? ''
  const lastDate = latest.books[latest.books.length - 1]?.date ?? ''
  const dateRange = firstDate === lastDate ? firstDate : `${firstDate} – ${lastDate}`

  return (
    <div className="min-h-screen bg-neo-bg font-sans relative">
      {/* Halftone background pattern */}
      <div className="bg-halftone absolute inset-0 pointer-events-none opacity-[0.035]" />

      {/* Header */}
      <header className="relative bg-black border-b-4 border-black px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <h1 className="text-5xl sm:text-7xl font-black uppercase tracking-tighter text-neo-secondary leading-none">
              Kobo 99
            </h1>
            <p className="text-white font-bold text-base sm:text-lg tracking-wide sm:mb-1">
              每週特價電子書 各平台評分一覽
            </p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {/* Week label */}
        <div className="inline-block mb-8">
          <div className="bg-neo-secondary border-4 border-black shadow-[6px_6px_0px_0px_#000] px-5 py-2 rotate-[-1deg]">
            <span className="font-black text-lg uppercase tracking-wide">
              第 {latest.week} 週 &nbsp;
            </span>
            <span className="font-bold text-base">{dateRange}</span>
          </div>
        </div>

        {/* Book grid */}
        {(() => {
          const todayBooks = latest.books.filter((b) => {
            const [m, d] = b.date.split('/').map(Number)
            const now = new Date()
            return now.getFullYear() === 2026 && now.getMonth() + 1 === m && now.getDate() === d
          })
          const otherBooks = latest.books.filter((b) => !todayBooks.includes(b))

          return (
            <div className="flex flex-col gap-6">
              {todayBooks.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {todayBooks.map((book) => (
                    <div
                      key={book.url}
                      className={todayBooks.length === 1 ? 'lg:col-span-2' : ''}
                    >
                      <BookCard book={book} year={2026} />
                    </div>
                  ))}
                </div>
              )}
              {otherBooks.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {otherBooks.map((book) => (
                    <BookCard key={book.url} book={book} year={2026} />
                  ))}
                </div>
              )}
            </div>
          )
        })()}
      </main>

      {/* Footer */}
      <footer className="relative border-t-4 border-black bg-black mt-16 px-6 py-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-neo-secondary font-bold text-sm tracking-widest uppercase">
            資料每週自動更新 · 評分僅供參考
          </p>
        </div>
      </footer>
    </div>
  )
}

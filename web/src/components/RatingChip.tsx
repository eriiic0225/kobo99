import { formatCount } from '../utils/rating'

const PLATFORM_STYLES: Record<string, string> = {
  Kobo: 'bg-neo-muted',
  讀墨: 'bg-blue-200',
  博客來: 'bg-green-200',
  Goodreads: 'bg-amber-200',
  Amazon: 'bg-orange-200',
}

type Props = {
  platform: string
  rating: number
  count: number | null
  url: string
}

export default function RatingChip({ platform, rating, count, url }: Props) {
  const bg = PLATFORM_STYLES[platform] ?? 'bg-gray-200'

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 px-2 py-1 border-2 border-black ${bg} font-bold text-xs hover:shadow-[2px_2px_0px_0px_#000] transition-shadow duration-100`}
    >
      <span className="text-black">★</span>
      <span>{rating.toFixed(1)}</span>
      <span className="opacity-60 font-medium">
        {platform}
        {count != null && count > 0 ? ` ${formatCount(count)} 則` : ''}
      </span>
    </a>
  )
}

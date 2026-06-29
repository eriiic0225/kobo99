type PlatformRating = { rating: number | null; ratingCount: number | null }

export function computeWeightedRating(
  platforms: (PlatformRating | null)[]
): number | null {
  let weightedSum = 0
  let totalCount = 0
  for (const p of platforms) {
    if (p?.rating != null && p?.ratingCount != null && p.ratingCount > 0) {
      weightedSum += p.rating * p.ratingCount
      totalCount += p.ratingCount
    }
  }
  return totalCount === 0 ? null : weightedSum / totalCount
}

export function formatCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}萬`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}千`
  return String(count)
}

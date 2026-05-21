export function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function scoreBadgeClass(score) {
  if (!score) return 'bg-gray-100 text-gray-400'
  if (score >= 8) return 'bg-green-100 text-green-700'
  if (score >= 5) return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-500'
}

import { formatDate, scoreBadgeClass } from '../utils'

export default function DocumentCard({ doc, onClick }) {
  const isPending = doc.status === 'pending' || doc.status === 'processing'
  const isError = doc.status === 'error'

  const topicChips = doc.categories?.filter((c) => c.type === 'topic') ?? []
  const useCaseChips = doc.categories?.filter((c) => c.type === 'use_case') ?? []

  // Pending / processing — skeleton card
  if (isPending) {
    return (
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 animate-pulse">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="w-7 h-7 bg-gray-200 rounded-full flex-shrink-0" />
        </div>
        <div className="space-y-2 mb-4">
          <div className="h-3 bg-gray-200 rounded" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
          <div className="h-3 bg-gray-200 rounded w-4/6" />
        </div>
        <div className="flex gap-1.5 mb-3">
          <div className="h-5 bg-gray-200 rounded-full w-20" />
          <div className="h-5 bg-gray-200 rounded-full w-16" />
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-ping" />
          <span className="text-xs text-gray-400">Processing…</span>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl p-5 shadow-sm border border-gray-100
        hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug">
          {doc.title || doc.url || 'Untitled'}
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isError && (
            <span className="text-xs bg-red-50 text-red-400 border border-red-100 px-2 py-0.5 rounded-full">
              Error
            </span>
          )}
          {doc.relevance_score != null && (
            <span
              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                ${scoreBadgeClass(doc.relevance_score)}`}
            >
              {doc.relevance_score}
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      {doc.summary && (
        <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-3">
          {doc.summary}
        </p>
      )}

      {/* Category chips */}
      {(topicChips.length > 0 || useCaseChips.length > 0) && (
        <div className="flex flex-wrap gap-1 mb-3">
          {topicChips.map((c) => (
            <span
              key={c.id}
              className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full"
            >
              {c.name}
            </span>
          ))}
          {useCaseChips.map((c) => (
            <span
              key={c.id}
              className="text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded-full"
            >
              {c.name}
            </span>
          ))}
        </div>
      )}

      {/* Meta */}
      <div className="text-xs text-gray-400 flex items-center gap-1.5">
        <span>{doc.uploaded_by}</span>
        <span>·</span>
        <span>{formatDate(doc.uploaded_at)}</span>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { getNotes } from '../api'
import { formatDate, scoreBadgeClass } from '../utils'

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  )
}

export default function DetailPanel({ doc, onClose }) {
  const [notes, setNotes] = useState({ notes: [], questions: [] })

  useEffect(() => {
    if (!doc || doc.status !== 'done') {
      setNotes({ notes: [], questions: [] })
      return
    }
    getNotes(doc.id)
      .then(setNotes)
      .catch(() => {})
  }, [doc?.id, doc?.status])

  const topicChips = doc?.categories?.filter((c) => c.type === 'topic') ?? []
  const useCaseChips = doc?.categories?.filter((c) => c.type === 'use_case') ?? []
  const isPending = doc?.status === 'pending' || doc?.status === 'processing'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          doc ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full md:w-[520px] bg-white z-50
          shadow-2xl transition-transform duration-300 overflow-y-auto ${
          doc ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {doc && (
          <>
            {/* Sticky header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 z-10">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 text-base leading-snug">
                    {doc.title || doc.url || 'Untitled'}
                  </h2>
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-0.5 block truncate"
                    >
                      {doc.url}
                    </a>
                  ) : doc.file_path ? (
                    <span className="text-xs text-gray-400 mt-0.5 block">Uploaded file</span>
                  ) : null}
                </div>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            {isPending ? (
              <div className="px-6 py-16 text-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Classifying document…</p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-6">
                {/* Score */}
                {doc.relevance_score != null && (
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex items-center justify-center w-10 h-10 rounded-full
                        text-base font-bold flex-shrink-0 ${scoreBadgeClass(doc.relevance_score)}`}
                    >
                      {doc.relevance_score}
                    </span>
                    {doc.relevance_reason && (
                      <p className="text-sm text-gray-600 leading-relaxed pt-1">
                        {doc.relevance_reason}
                      </p>
                    )}
                  </div>
                )}

                {/* Chips */}
                {(topicChips.length > 0 || useCaseChips.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {topicChips.map((c) => (
                      <span key={c.id}
                        className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full">
                        {c.name}
                      </span>
                    ))}
                    {useCaseChips.map((c) => (
                      <span key={c.id}
                        className="text-xs bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-full">
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}

                {doc.summary && (
                  <Section title="Summary">
                    <p className="text-sm text-gray-600 leading-relaxed">{doc.summary}</p>
                  </Section>
                )}

                {doc.tension && (
                  <Section title="What this complicates">
                    <p className="text-sm text-gray-600 leading-relaxed">{doc.tension}</p>
                  </Section>
                )}

                {doc.next_steps?.length > 0 && (
                  <Section title="Actions for the team">
                    <ul className="space-y-2">
                      {doc.next_steps.map((step, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-600">
                          <span className="text-gray-300 mt-0.5 flex-shrink-0">→</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {doc.auto_questions?.length > 0 && (
                  <Section title="Questions this raises">
                    <ul className="space-y-2">
                      {doc.auto_questions.map((q, i) => (
                        <li key={i} className="text-sm text-gray-600 bg-gray-50 px-3 py-2.5 rounded-lg">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* Team notes (read-only Phase 2) */}
                <Section title="Team notes">
                  {notes.notes.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No notes yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {notes.notes.map((note) => (
                        <div key={note.id} className="bg-gray-50 rounded-lg px-3 py-2.5">
                          <p className="text-sm text-gray-700">{note.content}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {note.added_by} · {formatDate(note.added_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Explore more placeholder */}
                <button
                  disabled
                  className="w-full text-sm border border-gray-200 text-gray-400
                    px-4 py-2.5 rounded-lg cursor-not-allowed"
                >
                  Explore more → (Phase 5)
                </button>

                <p className="text-xs text-gray-400 pb-2">
                  Added by {doc.uploaded_by} · {formatDate(doc.uploaded_at)}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

import { useEffect, useState } from 'react'
import { getNotes, createNote } from '../api'
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

// Shared component for both notes and team questions
function NoteSection({ docId, title, isQuestion, items, onItemAdded }) {
  const [content, setContent] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return
    if (!name.trim()) { setError('Please enter your name.'); return }

    setError(null)

    // Optimistic update — add a temporary entry immediately
    const tempId = `temp-${Date.now()}`
    const optimistic = {
      id: tempId,
      content: content.trim(),
      added_by: name.trim(),
      added_at: new Date().toISOString(),
      is_question: isQuestion,
      _pending: true,
    }
    onItemAdded(optimistic, isQuestion)
    const savedContent = content
    const savedName = name
    setContent('')
    setSubmitting(true)

    try {
      const real = await createNote(docId, {
        content: savedContent.trim(),
        added_by: savedName.trim(),
        is_question: isQuestion,
      })
      // Replace the optimistic entry with the real one
      onItemAdded(real, isQuestion, tempId)
    } catch (err) {
      // Roll back the optimistic entry and restore the form
      onItemAdded(null, isQuestion, tempId)
      setContent(savedContent)
      setError(err.message || 'Failed to save. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Section title={title}>
      {/* Existing items */}
      {items.length > 0 && (
        <div className="space-y-2 mb-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-gray-50 rounded-lg px-3 py-2.5 transition-opacity ${
                item._pending ? 'opacity-50' : ''
              }`}
            >
              <p className="text-sm text-gray-700">{item.content}</p>
              <p className="text-xs text-gray-400 mt-1">
                {item.added_by} · {formatDate(item.added_at)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isQuestion ? 'Add a question…' : 'Add a note…'}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg
              hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {submitting ? '…' : 'Add'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </form>
    </Section>
  )
}

export default function DetailPanel({ doc, onClose }) {
  const [noteItems, setNoteItems] = useState([])
  const [questionItems, setQuestionItems] = useState([])

  useEffect(() => {
    if (!doc || doc.status !== 'done') {
      setNoteItems([])
      setQuestionItems([])
      return
    }
    getNotes(doc.id)
      .then(({ notes, questions }) => {
        setNoteItems(notes)
        setQuestionItems(questions)
      })
      .catch(() => {})
  }, [doc?.id, doc?.status])

  // Handles optimistic adds and rollbacks for both lists
  const handleItemAdded = (item, isQuestion, replaceId) => {
    const setter = isQuestion ? setQuestionItems : setNoteItems
    setter((prev) => {
      if (!item) {
        // Rollback: remove the temp entry
        return prev.filter((i) => i.id !== replaceId)
      }
      if (replaceId) {
        // Replace temp with confirmed item from server
        return prev.map((i) => (i.id === replaceId ? item : i))
      }
      // New optimistic entry
      return [...prev, item]
    })
  }

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

                {/* Category chips */}
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

                {/* Team notes */}
                <NoteSection
                  docId={doc.id}
                  title="Team notes"
                  isQuestion={false}
                  items={noteItems}
                  onItemAdded={handleItemAdded}
                />

                {/* Team questions */}
                <NoteSection
                  docId={doc.id}
                  title="Team questions"
                  isQuestion={true}
                  items={questionItems}
                  onItemAdded={handleItemAdded}
                />

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

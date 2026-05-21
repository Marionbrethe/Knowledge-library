import { useState, useCallback } from 'react'
import { updateCategory } from '../api'

export default function CategoriesTab({ topicCategories, useCaseCategories, onCategoryUpdated }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Category definitions</h2>
        <p className="text-sm text-gray-500">
          These descriptions tell the AI what to look for when classifying new documents.
          Click any description to edit it inline.
        </p>
      </div>

      <Section
        title="Topic categories"
        categories={topicCategories}
        onCategoryUpdated={onCategoryUpdated}
      />
      <Section
        title="Use-case tags"
        categories={useCaseCategories}
        onCategoryUpdated={onCategoryUpdated}
      />
    </div>
  )
}

function Section({ title, categories, onCategoryUpdated }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{title}</h3>
      <div className="space-y-2">
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No categories yet.</p>
        ) : (
          categories.map((cat) => (
            <CategoryRow key={cat.id} cat={cat} onCategoryUpdated={onCategoryUpdated} />
          ))
        )}
      </div>
    </section>
  )
}

function CategoryRow({ cat, onCategoryUpdated }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cat.description || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = useCallback(async () => {
    const trimmed = draft.trim()
    if (trimmed === (cat.description || '').trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateCategory(cat.id, { description: trimmed })
      onCategoryUpdated(updated)
      setEditing(false)
    } catch (err) {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [cat, draft, onCategoryUpdated])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setDraft(cat.description || '')
      setEditing(false)
      setError(null)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 mb-1">{cat.name}</p>

          {editing ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                placeholder="Describe what this category covers and what the AI should look for…"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none
                  focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg
                    hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setDraft(cat.description || ''); setEditing(false); setError(null) }}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setDraft(cat.description || ''); setEditing(true) }}
              className="text-left w-full group"
            >
              {cat.description ? (
                <p className="text-sm text-gray-500 leading-relaxed group-hover:text-gray-700 transition-colors">
                  {cat.description}
                </p>
              ) : (
                <p className="text-sm text-gray-300 italic group-hover:text-gray-400 transition-colors">
                  Click to add a description…
                </p>
              )}
            </button>
          )}
        </div>

        {!editing && (
          <button
            onClick={() => { setDraft(cat.description || ''); setEditing(true) }}
            className="flex-shrink-0 p-1.5 text-gray-300 hover:text-gray-500 rounded-lg
              hover:bg-gray-50 transition-colors"
            title="Edit description"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a4 4 0 01-2.828 1.172H7v-2a4 4 0 011.172-2.828z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

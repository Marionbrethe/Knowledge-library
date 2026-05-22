import { useState, useCallback } from 'react'
import { updateCategory, createCategory } from '../api'

export default function CategoriesTab({ topicCategories, useCaseCategories, onCategoryUpdated, onCategoryCreated }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Category definitions</h2>
        <p className="text-sm text-gray-500">
          Edit names or descriptions inline, or add new categories below. Descriptions tell
          the AI what to look for when classifying documents.
        </p>
      </div>

      <Section
        title="Topic categories"
        type="topic"
        categories={topicCategories}
        onCategoryUpdated={onCategoryUpdated}
        onCategoryCreated={onCategoryCreated}
      />
      <Section
        title="Use-case tags"
        type="use_case"
        categories={useCaseCategories}
        onCategoryUpdated={onCategoryUpdated}
        onCategoryCreated={onCategoryCreated}
      />
    </div>
  )
}

function Section({ title, type, categories, onCategoryUpdated, onCategoryCreated }) {
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  const handleAdd = useCallback(async () => {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    setAddError(null)
    try {
      const cat = await createCategory({
        name,
        type,
        created_by: 'team',
        description: newDesc.trim() || null,
      })
      onCategoryCreated(cat)
      setNewName('')
      setNewDesc('')
      setShowForm(false)
    } catch (err) {
      setAddError(err.status === 409 ? 'A category with this name already exists.' : 'Failed to add. Please try again.')
    } finally {
      setAdding(false)
    }
  }, [newName, newDesc, type, onCategoryCreated])

  const cancelAdd = () => { setShowForm(false); setNewName(''); setNewDesc(''); setAddError(null) }

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{title}</h3>

      <div className="space-y-2">
        {categories.length === 0 && !showForm && (
          <p className="text-sm text-gray-400 italic">No categories yet.</p>
        )}
        {categories.map((cat) => (
          <CategoryRow key={cat.id} cat={cat} onCategoryUpdated={onCategoryUpdated} />
        ))}
      </div>

      {showForm ? (
        <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') cancelAdd(); if (e.key === 'Enter') handleAdd() }}
            placeholder="Category name…"
            className="w-full text-sm font-medium border border-gray-200 rounded-lg px-3 py-2
              focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            rows={2}
            placeholder="Description (optional) — what should the AI look for?"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none
              focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          {addError && <p className="text-xs text-red-500">{addError}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg
                hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
            <button
              onClick={cancelAdd}
              disabled={adding}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-3 flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add {type === 'topic' ? 'topic category' : 'use-case tag'}
        </button>
      )}
    </section>
  )
}

function CategoryRow({ cat, onCategoryUpdated }) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(cat.name)
  const [draftDesc, setDraftDesc] = useState(cat.description || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleEdit = () => {
    setDraftName(cat.name)
    setDraftDesc(cat.description || '')
    setEditing(true)
  }

  const handleCancel = () => {
    setDraftName(cat.name)
    setDraftDesc(cat.description || '')
    setEditing(false)
    setError(null)
  }

  const handleSave = useCallback(async () => {
    const name = draftName.trim()
    const desc = draftDesc.trim()
    if (!name) return
    if (name === cat.name && desc === (cat.description || '').trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    const updates = {}
    if (name !== cat.name) updates.name = name
    if (desc !== (cat.description || '').trim()) updates.description = desc
    try {
      const updated = await updateCategory(cat.id, updates)
      onCategoryUpdated(updated)
      setEditing(false)
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [cat, draftName, draftDesc, onCategoryUpdated])

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                autoFocus
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
                placeholder="Category name…"
                className="w-full text-sm font-medium border border-gray-200 rounded-lg px-3 py-2
                  focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              <textarea
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') handleCancel() }}
                rows={3}
                placeholder="Describe what this category covers and what the AI should look for…"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none
                  focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !draftName.trim()}
                  className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg
                    hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-800 mb-1">{cat.name}</p>
              <button onClick={handleEdit} className="text-left w-full group">
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
            </>
          )}
        </div>

        {!editing && (
          <button
            onClick={handleEdit}
            className="flex-shrink-0 p-1.5 text-gray-300 hover:text-gray-500 rounded-lg
              hover:bg-gray-50 transition-colors"
            title="Edit"
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

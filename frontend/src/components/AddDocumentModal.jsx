import { useState, useCallback } from 'react'
import { createDocument } from '../api'
import CategorySelect from './CategorySelect'

export default function AddDocumentModal({
  topicCategories,
  useCaseCategories,
  onDocumentAdded,
  onCategoryCreated,
  onClose,
}) {
  const [mode, setMode] = useState('url') // 'url' | 'file'
  const [url, setUrl] = useState('')
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [selectedTopics, setSelectedTopics] = useState([])
  const [selectedUseCases, setSelectedUseCases] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleCategoryCreated = useCallback(
    (cat) => onCategoryCreated(cat),
    [onCategoryCreated]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (mode === 'url' && !url.trim()) { setError('Please enter a URL.'); return }
    if (mode === 'file' && !file) { setError('Please select a file.'); return }

    setLoading(true)
    setError(null)

    const allCategoryIds = [
      ...selectedTopics.map((c) => c.id),
      ...selectedUseCases.map((c) => c.id),
    ]

    const formData = new FormData()
    if (mode === 'url') formData.append('url', url.trim())
    else formData.append('file', file)
    formData.append('uploaded_by', name.trim())
    formData.append('category_ids', JSON.stringify(allCategoryIds))

    try {
      const doc = await createDocument(formData)
      onDocumentAdded(doc)
      onClose()
    } catch (err) {
      if (err.status === 409) {
        setError('This URL has already been added to the library.')
      } else {
        setError(err.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Add Document" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* URL / File toggle */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {['url', 'file'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setFile(null); setUrl('') }}
              className={`flex-1 py-1.5 text-sm rounded-md transition-colors font-medium ${
                mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              {m === 'url' ? 'URL' : 'File upload'}
            </button>
          ))}
        </div>

        {mode === 'url' ? (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">File</label>
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              onChange={(e) => setFile(e.target.files[0] ?? null)}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3
                file:rounded-lg file:border-0 file:text-sm file:font-medium
                file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Your name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Marion"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>

        {/* Topic categories */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Topic categories
          </label>
          <CategorySelect
            categories={topicCategories}
            selected={selectedTopics}
            onChange={(cats) => {
              setSelectedTopics(cats)
              cats.filter((c) => !topicCategories.find((t) => t.id === c.id))
                .forEach(handleCategoryCreated)
            }}
            type="topic"
            placeholder="Search or create…"
            createdBy={name}
          />
        </div>

        {/* Use-case tags */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Use-case tags
          </label>
          <CategorySelect
            categories={useCaseCategories}
            selected={selectedUseCases}
            onChange={(cats) => {
              setSelectedUseCases(cats)
              cats.filter((c) => !useCaseCategories.find((u) => u.id === c.id))
                .forEach(handleCategoryCreated)
            }}
            type="use_case"
            placeholder="Search or create…"
            createdBy={name}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm
              hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm
              hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? 'Adding…' : 'Add document'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh]
        overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { bulkImport } from '../api'
import { Modal } from './AddDocumentModal'

export default function BulkImportModal({ onDocumentsAdded, onClose }) {
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!text.trim()) { setError('Please paste some text containing URLs.'); return }

    setLoading(true)
    setError(null)

    try {
      const res = await bulkImport({ raw_text: text, uploaded_by: name.trim() })
      setResult(res)
      if (res.added_documents?.length > 0) {
        onDocumentsAdded(res.added_documents)
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Bulk Import" onClose={onClose}>
      {result ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
            <p className="text-sm font-medium text-green-800">
              {result.added_count} document{result.added_count !== 1 ? 's' : ''} added
            </p>
          </div>

          {result.duplicate_urls?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">
                {result.duplicate_urls.length} already in library (skipped):
              </p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {result.duplicate_urls.map((u) => (
                  <li key={u} className="text-xs text-gray-400 truncate">{u}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm
              hover:bg-gray-800 transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Paste a block of text containing URLs
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              placeholder="Paste a WhatsApp export, email, Slack message, or any text…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
            />
          </div>

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
              {loading ? 'Importing…' : 'Import URLs'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

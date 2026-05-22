import { useState, useEffect, useCallback } from 'react'
import {
  getMonitoringSources,
  getMonitoringArticles,
  getMonitoringCount,
  addMonitoringSource,
  deleteMonitoringSource,
  checkMonitoringSources,
  dismissArticle,
  addArticleToLibrary,
} from '../api'

export default function MonitoringTab({ onCountChange, onDocumentAdded }) {
  const [sources, setSources] = useState([])
  const [articles, setArticles] = useState([])
  const [loadingSources, setLoadingSources] = useState(true)
  const [loadingArticles, setLoadingArticles] = useState(true)

  // Check sources state
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null) // { newFound: int } | null

  // Add source form
  const [showAddForm, setShowAddForm] = useState(false)
  const [addName, setAddName] = useState('')
  const [addUrl, setAddUrl] = useState('')
  const [addError, setAddError] = useState(null)
  const [addLoading, setAddLoading] = useState(false)

  // Article add-to-library state: { [articleId]: 'idle' | 'loading' | 'added' }
  const [addStates, setAddStates] = useState({})

  // Dismiss fade state: set of article ids being dismissed
  const [dismissingIds, setDismissingIds] = useState(new Set())

  const loadSources = useCallback(async () => {
    try {
      const data = await getMonitoringSources()
      setSources(data)
    } catch (e) {
      console.error('Failed to load sources', e)
    } finally {
      setLoadingSources(false)
    }
  }, [])

  const loadArticles = useCallback(async () => {
    try {
      const data = await getMonitoringArticles()
      setArticles(data)
    } catch (e) {
      console.error('Failed to load articles', e)
    } finally {
      setLoadingArticles(false)
    }
  }, [])

  useEffect(() => {
    loadSources()
    loadArticles()
  }, [loadSources, loadArticles])

  // Notify parent whenever articles list changes
  useEffect(() => {
    onCountChange(articles.length)
  }, [articles, onCountChange])

  const handleCheck = async () => {
    setChecking(true)
    setCheckResult(null)
    try {
      const result = await checkMonitoringSources()
      await Promise.all([loadSources(), loadArticles()])
      setCheckResult({ newFound: result.new_articles_found })
      // Fade message after 5s
      setTimeout(() => setCheckResult(null), 5000)
      // Sync count from server
      getMonitoringCount()
        .then(({ count }) => onCountChange(count))
        .catch(() => {})
    } catch (e) {
      console.error('Check failed', e)
    } finally {
      setChecking(false)
    }
  }

  const handleAddSource = async () => {
    if (!addName.trim() || !addUrl.trim()) return
    setAddLoading(true)
    setAddError(null)
    try {
      const source = await addMonitoringSource({ name: addName.trim(), url: addUrl.trim() })
      setSources((prev) => [...prev, source])
      setAddName('')
      setAddUrl('')
      setShowAddForm(false)
    } catch (e) {
      if (e.status === 409) {
        setAddError('This URL is already being monitored.')
      } else {
        setAddError(e.message || 'Failed to add source.')
      }
    } finally {
      setAddLoading(false)
    }
  }

  const handleDeleteSource = async (id) => {
    try {
      await deleteMonitoringSource(id)
      setSources((prev) => prev.filter((s) => s.id !== id))
    } catch (e) {
      console.error('Delete source failed', e)
    }
  }

  const handleAddArticle = async (articleId) => {
    setAddStates((prev) => ({ ...prev, [articleId]: 'loading' }))
    try {
      const doc = await addArticleToLibrary(articleId)
      setAddStates((prev) => ({ ...prev, [articleId]: 'added' }))
      if (onDocumentAdded) onDocumentAdded(doc)
      // Remove from local list after short delay
      setTimeout(() => {
        setArticles((prev) => prev.filter((a) => a.id !== articleId))
      }, 800)
      getMonitoringCount()
        .then(({ count }) => onCountChange(count))
        .catch(() => {})
    } catch (e) {
      setAddStates((prev) => ({ ...prev, [articleId]: 'idle' }))
      console.error('Add article failed', e)
    }
  }

  const handleDismiss = async (articleId) => {
    setDismissingIds((prev) => new Set([...prev, articleId]))
    try {
      await dismissArticle(articleId)
      setTimeout(() => {
        setArticles((prev) => prev.filter((a) => a.id !== articleId))
        setDismissingIds((prev) => {
          const next = new Set(prev)
          next.delete(articleId)
          return next
        })
      }, 300)
      getMonitoringCount()
        .then(({ count }) => onCountChange(count))
        .catch(() => {})
    } catch (e) {
      setDismissingIds((prev) => {
        const next = new Set(prev)
        next.delete(articleId)
        return next
      })
      console.error('Dismiss failed', e)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return null
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Section 1: Monitored Sources */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Monitored Sources</h2>
          <button
            onClick={handleCheck}
            disabled={checking || sources.length === 0}
            className="inline-flex items-center gap-2 bg-gray-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {checking ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Checking {sources.length} source{sources.length !== 1 ? 's' : ''}…
              </>
            ) : (
              'Check sources'
            )}
          </button>
        </div>

        {/* Check result message */}
        {checkResult !== null && (
          <p className="text-sm text-gray-600 mb-3 transition-opacity duration-500">
            {checkResult.newFound > 0
              ? `Found ${checkResult.newFound} new article${checkResult.newFound !== 1 ? 's' : ''}`
              : 'All up to date'}
          </p>
        )}

        {/* Sources list */}
        {loadingSources ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <p className="text-sm text-gray-400">No sources yet. Add one below.</p>
        ) : (
          <div className="space-y-3">
            {sources.map((source) => (
              <div
                key={source.id}
                className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">{source.name}</span>
                    {source.new_count > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-semibold bg-amber-400 text-white rounded-full px-1">
                        {source.new_count}
                      </span>
                    )}
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate block max-w-sm mt-0.5"
                  >
                    {source.url}
                  </a>
                  {source.last_checked_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      Last checked {formatDate(source.last_checked_at)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteSource(source.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none flex-shrink-0 mt-0.5"
                  title="Remove source"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add source form */}
        <div className="mt-4">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
            >
              <span className="text-lg leading-none">+</span> Add a source
            </button>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Add a source</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Name (e.g. TechCrunch)"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                <input
                  type="url"
                  placeholder="URL (e.g. https://techcrunch.com)"
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
              {addError && <p className="text-xs text-red-500">{addError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAddSource}
                  disabled={addLoading || !addName.trim() || !addUrl.trim()}
                  className="bg-gray-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {addLoading ? 'Adding…' : 'Add'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    setAddName('')
                    setAddUrl('')
                    setAddError(null)
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: New articles */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">New articles</h2>
          {articles.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] text-xs font-semibold bg-gray-200 text-gray-700 rounded-full px-1.5">
              {articles.length}
            </span>
          )}
        </div>

        {loadingArticles ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No new articles. Click &apos;Check sources&apos; to look for updates.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => {
              const state = addStates[article.id] || 'idle'
              const isDismissing = dismissingIds.has(article.id)
              return (
                <div
                  key={article.id}
                  className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm transition-opacity duration-300 ${
                    isDismissing ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {article.source_name}
                        </span>
                        {article.found_at && (
                          <span className="text-xs text-gray-400">{formatDate(article.found_at)}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 leading-snug mb-1">
                        {article.title || '(No title)'}
                      </p>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline block truncate max-w-md"
                      >
                        {article.url}
                      </a>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleAddArticle(article.id)}
                        disabled={state !== 'idle'}
                        className="inline-flex items-center gap-1.5 bg-gray-900 text-white rounded-xl px-3 py-1.5 text-xs font-medium hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                      >
                        {state === 'loading' ? (
                          <>
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Adding…
                          </>
                        ) : state === 'added' ? (
                          '✓ Added'
                        ) : (
                          '+ Add to library'
                        )}
                      </button>
                      <button
                        onClick={() => handleDismiss(article.id)}
                        className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

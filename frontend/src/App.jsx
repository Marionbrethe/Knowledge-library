import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { getDocuments, getCategories } from './api'
import TopBar from './components/TopBar'
import FilterSidebar from './components/FilterSidebar'
import DocumentCard from './components/DocumentCard'
import DetailPanel from './components/DetailPanel'
import AddDocumentModal from './components/AddDocumentModal'
import BulkImportModal from './components/BulkImportModal'
import AskTab from './components/AskTab'
import CategoriesTab from './components/CategoriesTab'

const TABS = ['library', 'ask', 'categories', 'explore']
const TAB_LABELS = { library: 'Library', ask: 'Ask', categories: 'Categories', explore: 'Explore' }

export default function App() {
  const [activeTab, setActiveTab] = useState('library')
  const [documents, setDocuments] = useState([])
  const [topicCategories, setTopicCategories] = useState([])
  const [useCaseCategories, setUseCaseCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Filters
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedTag, setSelectedTag] = useState(null)
  const [sortBy, setSortBy] = useState('score')
  const [searchQuery, setSearchQuery] = useState('')

  // UI state
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Ref so the polling interval always sees the latest documents
  const docsRef = useRef(documents)
  docsRef.current = documents

  const loadAll = useCallback(async () => {
    try {
      const [docs, topics, useCases] = await Promise.all([
        getDocuments(),
        getCategories('topic'),
        getCategories('use_case'),
      ])
      setDocuments(docs)
      setTopicCategories(topics)
      setUseCaseCategories(useCases)
      setLoadError(null)
    } catch (err) {
      setLoadError('Failed to connect to the backend. Is it running?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Poll every 5 s while any document is pending/processing
  useEffect(() => {
    const id = setInterval(async () => {
      const hasPending = docsRef.current.some(
        (d) => d.status === 'pending' || d.status === 'processing'
      )
      if (!hasPending) return
      try {
        const fresh = await getDocuments()
        setDocuments(fresh)
        // Keep the detail panel in sync if its document changed
        setSelectedDoc((prev) => {
          if (!prev) return null
          return fresh.find((d) => d.id === prev.id) ?? prev
        })
      } catch (_) {}
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const handleDocumentAdded = useCallback((doc) => {
    setDocuments((prev) => [doc, ...prev])
  }, [])

  const handleDocumentsAdded = useCallback((docs) => {
    setDocuments((prev) => [...docs, ...prev])
  }, [])

  const handleCategoryCreated = useCallback((cat) => {
    const setter = cat.type === 'topic' ? setTopicCategories : setUseCaseCategories
    setter((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
  }, [])

  const handleCategoryUpdated = useCallback((cat) => {
    const setter = cat.type === 'topic' ? setTopicCategories : setUseCaseCategories
    setter((prev) => prev.map((c) => (c.id === cat.id ? cat : c)))
  }, [])

  const filteredDocs = useMemo(() => {
    let docs = [...documents]

    if (selectedCategory) {
      docs = docs.filter((d) => d.categories?.some((c) => c.id === selectedCategory))
    }
    if (selectedTag) {
      docs = docs.filter((d) => d.categories?.some((c) => c.id === selectedTag))
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      docs = docs.filter(
        (d) =>
          d.title?.toLowerCase().includes(q) ||
          d.summary?.toLowerCase().includes(q)
      )
    }

    docs.sort((a, b) =>
      sortBy === 'score'
        ? (b.relevance_score ?? -1) - (a.relevance_score ?? -1)
        : new Date(b.uploaded_at) - new Date(a.uploaded_at)
    )

    return docs
  }, [documents, selectedCategory, selectedTag, searchQuery, sortBy])

  const filterProps = {
    topicCategories,
    useCaseCategories,
    selectedCategory,
    selectedTag,
    sortBy,
    searchQuery,
    onCategoryChange: setSelectedCategory,
    onTagChange: setSelectedTag,
    onSortChange: setSortBy,
    onSearchChange: setSearchQuery,
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] font-sans">
      <TopBar
        onAddDocument={() => setShowAddModal(true)}
        onBulkImport={() => setShowBulkModal(true)}
        onToggleMobileFilters={() => setShowMobileFilters((v) => !v)}
      />

      {/* Tab navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-20">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Library tab */}
      {activeTab === 'library' && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Mobile filter toggle bar */}
          <div className="lg:hidden mb-4 flex items-center gap-3">
            <button
              onClick={() => setShowMobileFilters((v) => !v)}
              className="flex items-center gap-1.5 text-sm border border-gray-200 bg-white px-3 py-2 rounded-lg hover:bg-gray-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 4h18M7 8h10M10 12h4" />
              </svg>
              Filters
              {(selectedCategory || selectedTag) && (
                <span className="w-1.5 h-1.5 bg-gray-900 rounded-full" />
              )}
            </button>
            {(selectedCategory || selectedTag || searchQuery) && (
              <button
                onClick={() => { setSelectedCategory(null); setSelectedTag(null); setSearchQuery('') }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Mobile filter panel */}
          {showMobileFilters && (
            <div
              className="lg:hidden fixed inset-0 z-40 bg-black/30"
              onClick={() => setShowMobileFilters(false)}
            >
              <div
                className="absolute top-[105px] left-0 right-0 bg-white shadow-xl rounded-b-xl p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <FilterSidebar
                  {...filterProps}
                  onCategoryChange={(v) => { setSelectedCategory(v); setShowMobileFilters(false) }}
                  onTagChange={(v) => { setSelectedTag(v); setShowMobileFilters(false) }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-7">
            {/* Desktop sidebar */}
            <aside className="hidden lg:block w-56 flex-shrink-0">
              <FilterSidebar {...filterProps} />
            </aside>

            {/* Main content */}
            <main className="flex-1 min-w-0">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : loadError ? (
                <div className="text-center py-24">
                  <p className="text-red-500 text-sm">{loadError}</p>
                  <button onClick={loadAll} className="mt-3 text-sm text-gray-500 underline">
                    Retry
                  </button>
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="text-center py-24 text-gray-400">
                  <p className="text-base font-medium text-gray-500">No documents yet</p>
                  <p className="text-sm mt-1">Add a URL or upload a file to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredDocs.map((doc) => (
                    <DocumentCard key={doc.id} doc={doc} onClick={() => setSelectedDoc(doc)} />
                  ))}
                </div>
              )}
            </main>
          </div>
        </div>
      )}

      {activeTab === 'ask' && (
        <AskTab
          documents={documents}
          onDocumentSelect={setSelectedDoc}
        />
      )}

      {activeTab === 'categories' && (
        <CategoriesTab
          topicCategories={topicCategories}
          useCaseCategories={useCaseCategories}
          onCategoryUpdated={handleCategoryUpdated}
        />
      )}

      {activeTab === 'explore' && (
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <p className="text-gray-400">Explore More — coming in Phase 5</p>
        </div>
      )}

      <DetailPanel doc={selectedDoc} onClose={() => setSelectedDoc(null)} />

      {showAddModal && (
        <AddDocumentModal
          topicCategories={topicCategories}
          useCaseCategories={useCaseCategories}
          onDocumentAdded={handleDocumentAdded}
          onCategoryCreated={handleCategoryCreated}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showBulkModal && (
        <BulkImportModal
          onDocumentsAdded={handleDocumentsAdded}
          onClose={() => setShowBulkModal(false)}
        />
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="w-7 h-7 bg-gray-200 rounded-full ml-2 flex-shrink-0" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 bg-gray-200 rounded" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
        <div className="h-3 bg-gray-200 rounded w-4/6" />
      </div>
      <div className="flex gap-2">
        <div className="h-5 bg-gray-200 rounded-full w-20" />
        <div className="h-5 bg-gray-200 rounded-full w-16" />
      </div>
    </div>
  )
}

export default function TopBar({ onAddDocument, onBulkImport }) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 h-14">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <span className="font-semibold text-gray-900 text-lg tracking-tight select-none">
          Lichen Library
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={onBulkImport}
            className="text-sm border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg
              hover:bg-gray-50 transition-colors"
          >
            Bulk Import
          </button>
          <button
            onClick={onAddDocument}
            className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg
              hover:bg-gray-800 transition-colors"
          >
            Add Document
          </button>
        </div>
      </div>
    </header>
  )
}

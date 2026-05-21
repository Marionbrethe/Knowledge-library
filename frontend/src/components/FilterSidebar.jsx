function FilterItem({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
        active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  )
}

export default function FilterSidebar({
  topicCategories,
  useCaseCategories,
  selectedCategory,
  selectedTag,
  sortBy,
  searchQuery,
  onCategoryChange,
  onTagChange,
  onSortChange,
  onSearchChange,
}) {
  return (
    <div className="space-y-5">
      {/* Search */}
      <div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search titles & summaries…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-gray-900/10 bg-white"
        />
      </div>

      {/* Sort */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Sort
        </p>
        <div className="flex gap-1">
          {[
            { key: 'score', label: 'By relevance' },
            { key: 'date', label: 'By date' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onSortChange(key)}
              className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                sortBy === key
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Topic categories */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Topic
        </p>
        <div className="space-y-0.5">
          <FilterItem
            label="All topics"
            active={!selectedCategory}
            onClick={() => onCategoryChange(null)}
          />
          {topicCategories.map((cat) => (
            <FilterItem
              key={cat.id}
              label={cat.name}
              active={selectedCategory === cat.id}
              onClick={() => onCategoryChange(selectedCategory === cat.id ? null : cat.id)}
            />
          ))}
        </div>
      </div>

      {/* Use-case tags */}
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Use case
        </p>
        <div className="space-y-0.5">
          <FilterItem
            label="All use cases"
            active={!selectedTag}
            onClick={() => onTagChange(null)}
          />
          {useCaseCategories.map((cat) => (
            <FilterItem
              key={cat.id}
              label={cat.name}
              active={selectedTag === cat.id}
              onClick={() => onTagChange(selectedTag === cat.id ? null : cat.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

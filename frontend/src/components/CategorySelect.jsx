import { useState, useRef } from 'react'
import { createCategory } from '../api'

export default function CategorySelect({
  categories,
  selected,       // [{ id, name, type }]
  onChange,       // (newSelected) => void
  type,           // 'topic' | 'use_case'
  placeholder,
  createdBy,
}) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const inputRef = useRef(null)

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(input.toLowerCase()) &&
      !selected.find((s) => s.id === c.id)
  )

  const canCreate =
    input.trim().length > 0 &&
    !categories.find((c) => c.name.toLowerCase() === input.trim().toLowerCase())

  const handleSelect = (cat) => {
    onChange([...selected, cat])
    setInput('')
    setOpen(false)
  }

  const handleRemove = (id) => onChange(selected.filter((c) => c.id !== id))

  const handleCreate = async () => {
    const name = input.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const newCat = await createCategory({ name, type, created_by: createdBy || 'team' })
      onChange([...selected, newCat])
      setInput('')
      setOpen(false)
    } catch (err) {
      console.error('Failed to create category:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="relative">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700
                px-2.5 py-1 rounded-full"
            >
              {cat.name}
              <button
                type="button"
                onClick={() => handleRemove(cat.id)}
                className="text-gray-400 hover:text-gray-700 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => { setInput(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-gray-900/10"
      />

      {/* Dropdown */}
      {open && (filtered.length > 0 || canCreate) && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg
          shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onMouseDown={() => handleSelect(cat)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              {cat.name}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={handleCreate}
              disabled={creating}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50
                font-medium transition-colors"
            >
              {creating ? 'Creating…' : `+ Create "${input.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

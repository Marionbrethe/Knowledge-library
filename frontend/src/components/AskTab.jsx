import { useState, useRef, useEffect, useCallback } from 'react'
import { queryLibrary } from '../api'

const STARTER_QUESTIONS = [
  "What have we collected on the mapping problem?",
  "What does the research say about tacit knowledge?",
  "Which papers are most relevant to our evals approach?",
  "What's our evidence base for the consultant pitch?",
]

export default function AskTab({ documents, onDocumentSelect }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const bottomRef = useRef(null)
  const timerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Clean up timer on unmount
  useEffect(() => () => clearInterval(timerRef.current), [])

  const handleSend = useCallback(
    async (question) => {
      question = (typeof question === 'string' ? question : input).trim()
      if (!question || loading) return

      // Snapshot history before updating state
      const history = messages.map((m) => ({ role: m.role, content: m.content }))

      setInput('')
      setMessages((prev) => [...prev, { role: 'user', content: question }])
      setLoading(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)

      try {
        const res = await queryLibrary({ question, conversation_history: history })
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: res.answer, sources: res.sources ?? [] },
        ])
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Something went wrong. Please check the backend is running and try again.',
            sources: [],
          },
        ])
      } finally {
        clearInterval(timerRef.current)
        setLoading(false)
        inputRef.current?.focus()
      }
    },
    [input, loading, messages]
  )

  const handleSourceClick = (docId) => {
    const doc = documents.find((d) => String(d.id) === String(docId))
    if (doc) onDocumentSelect(doc)
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 108px)' }}>
      {/* Clear button — only shown once conversation has started */}
      {messages.length > 0 && (
        <div className="flex justify-end px-4 py-2 bg-white border-b border-gray-100">
          <button
            onClick={() => { setMessages([]); setInput('') }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Clear conversation
          </button>
        </div>
      )}

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState onSelect={handleSend} />
        ) : (
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} onSourceClick={handleSourceClick} />
            ))}
            {loading && <LoadingBubble elapsed={elapsed} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSend() }}
            placeholder="Ask the library…"
            disabled={loading}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium
              hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onSelect }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-20">
      <h2 className="text-lg font-semibold text-gray-700 mb-1">Ask the Library</h2>
      <p className="text-sm text-gray-400 mb-8">
        Ask anything across all documents in your library.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
        {STARTER_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSelect(q)}
            className="text-left text-sm text-gray-600 bg-white border border-gray-200
              rounded-xl px-4 py-3 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

function Message({ msg, onSourceClick }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-gray-900 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
          <p className="text-sm leading-relaxed">{msg.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </p>
        </div>
        {msg.sources?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {msg.sources.map((src) => (
              <button
                key={src.id}
                onClick={() => onSourceClick(src.id)}
                className="text-xs bg-blue-50 text-blue-700 border border-blue-100
                  px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors"
              >
                {src.title || src.url || 'Document'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingBubble({ elapsed }) {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin flex-shrink-0" />
          <span>Searching the library…{elapsed > 0 ? ` ${elapsed}s` : ''}</span>
        </div>
      </div>
    </div>
  )
}

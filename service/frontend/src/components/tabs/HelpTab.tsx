import { useState, useEffect, useRef } from 'react'

interface Workflow {
  id: string
  name: string
  filename: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function HelpTab() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('')
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingWorkflows, setLoadingWorkflows] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch workflows on mount
  useEffect(() => {
    fetchWorkflows()
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchWorkflows = async () => {
    try {
      setLoadingWorkflows(true)
      const res = await fetch('/api/help/workflows')
      const data = await res.json()
      setWorkflows(data.workflows || [])
      // Auto-select first workflow if available
      if (data.workflows?.length > 0) {
        setSelectedWorkflow(data.workflows[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
    } finally {
      setLoadingWorkflows(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!question.trim() || !selectedWorkflow) return

    const userMessage = question.trim()
    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: selectedWorkflow,
          question: userMessage
        })
      })

      const data = await res.json()

      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `오류가 발생했습니다: ${data.detail || '알 수 없는 오류'}`
        }])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '서버와 통신 중 오류가 발생했습니다. 다시 시도해주세요.'
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setMessages([])
    setQuestion('')
  }

  const selectedWorkflowName = workflows.find(w => w.id === selectedWorkflow)?.name || ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-2">워크플로우 도우미</h2>
        <p className="text-gray-400">
          워크플로우를 선택하고 궁금한 점을 물어보세요. AI가 해당 워크플로우를 분석하여 답변해드립니다.
        </p>
      </div>

      {/* Workflow Selector */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          워크플로우 선택
        </label>
        {loadingWorkflows ? (
          <div className="h-10 bg-gray-700 rounded animate-pulse" />
        ) : (
          <select
            value={selectedWorkflow}
            onChange={(e) => setSelectedWorkflow(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="" disabled>워크플로우를 선택하세요</option>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </select>
        )}
        {selectedWorkflow && (
          <p className="mt-2 text-sm text-gray-500">
            파일: {workflows.find(w => w.id === selectedWorkflow)?.filename}
          </p>
        )}
      </div>

      {/* Chat Area */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        {/* Messages */}
        <div className="h-96 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-center">
                {selectedWorkflow
                  ? `"${selectedWorkflowName}" 워크플로우에 대해 질문해보세요!`
                  : '먼저 워크플로우를 선택해주세요'}
              </p>
              <div className="mt-4 text-sm text-gray-600">
                <p>예시 질문:</p>
                <ul className="mt-2 space-y-1">
                  <li>• 프롬프트는 어디서 수정하나요?</li>
                  <li>• 영상 길이를 늘리려면 어떻게 하나요?</li>
                  <li>• LoRA를 적용하려면 어떤 노드를 사용하나요?</li>
                </ul>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-100'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      {formatMarkdown(message.content)}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-700 p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={selectedWorkflow ? "질문을 입력하세요..." : "먼저 워크플로우를 선택하세요"}
              disabled={!selectedWorkflow || loading}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!selectedWorkflow || !question.trim() || loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                title="대화 지우기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">도움말</h3>
        <ul className="text-sm text-gray-500 space-y-1">
          <li>• 워크플로우를 선택하면 AI가 해당 워크플로우의 구조를 자동으로 분석합니다</li>
          <li>• 노드 이름, 파라미터 위치, 수정 방법 등을 물어보세요</li>
          <li>• 워크플로우를 변경하면 새로운 컨텍스트로 질문할 수 있습니다</li>
        </ul>
      </div>
    </div>
  )
}

// Simple markdown formatter for code blocks and lists
function formatMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeContent = ''
  let key = 0

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        elements.push(
          <pre key={key++} className="bg-gray-900 rounded p-3 overflow-x-auto my-2">
            <code className="text-sm text-gray-300">{codeContent.trim()}</code>
          </pre>
        )
        codeContent = ''
        inCodeBlock = false
      } else {
        // Start code block
        inCodeBlock = true
      }
    } else if (inCodeBlock) {
      codeContent += line + '\n'
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-xl font-bold mt-4 mb-2">{line.slice(2)}</h1>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-lg font-bold mt-3 mb-2">{line.slice(3)}</h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-base font-bold mt-2 mb-1">{line.slice(4)}</h3>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={key++} className="ml-4">{line.slice(2)}</li>)
    } else if (/^\d+\. /.test(line)) {
      elements.push(<li key={key++} className="ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>)
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={key++} className="border-l-4 border-blue-500 pl-3 my-2 text-gray-400">
          {line.slice(2)}
        </blockquote>
      )
    } else if (line.trim() === '') {
      elements.push(<br key={key++} />)
    } else {
      // Handle inline code
      const parts = line.split(/(`[^`]+`)/)
      const formattedParts = parts.map((part, i) => {
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="bg-gray-900 px-1 rounded text-blue-300">{part.slice(1, -1)}</code>
        }
        // Handle bold
        return part.split(/(\*\*[^*]+\*\*)/).map((subpart, j) => {
          if (subpart.startsWith('**') && subpart.endsWith('**')) {
            return <strong key={`${i}-${j}`}>{subpart.slice(2, -2)}</strong>
          }
          return subpart
        })
      })
      elements.push(<p key={key++} className="my-1">{formattedParts}</p>)
    }
  }

  return <>{elements}</>
}

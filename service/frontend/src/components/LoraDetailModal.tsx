import { useState, useRef } from 'react'
import type { LoraModel } from '../types'

interface LoraDetailModalProps {
  lora: LoraModel
  onClose: () => void
  onDownloadComplete?: () => void
}

export function LoraDetailModal({ lora, onClose, onDownloadComplete }: LoraDetailModalProps) {
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [currentFile, setCurrentFile] = useState<string>('')

  // Use ref to track completion state (avoids stale closure in onclose)
  const completedRef = useRef(false)

  const handleDownload = async () => {
    setDownloading(true)
    setError(null)
    setProgress(0)
    completedRef.current = false

    try {
      // 1. Validate download
      const validateRes = await fetch(`/api/loras/validate-download?lora_id=${lora.id}`, {
        method: 'POST'
      })
      if (!validateRes.ok) {
        setError(`서버 오류: ${validateRes.status}`)
        setDownloading(false)
        return
      }
      const validation = await validateRes.json()

      if (!validation.valid) {
        setError(validation.error || '다운로드 검증 실패')
        setDownloading(false)
        return
      }

      // 2. Connect WebSocket for download
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/download/${lora.id}`)

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'progress') {
            setProgress(data.progress)
            if (data.filename) {
              setCurrentFile(data.filename)
            }
          } else if (data.type === 'complete') {
            completedRef.current = true
            setDownloading(false)
            setProgress(100)
            if (onDownloadComplete) {
              onDownloadComplete()
            }
          } else if (data.type === 'error') {
            completedRef.current = true
            setError(data.error || '다운로드 실패')
            setDownloading(false)
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      ws.onerror = () => {
        setError('WebSocket 연결 실패')
        setDownloading(false)
      }

      ws.onclose = () => {
        if (!completedRef.current) {
          setError('연결이 끊어졌습니다')
          setDownloading(false)
        }
      }
    } catch (err) {
      setError('다운로드 시작 실패')
      setDownloading(false)
    }
  }
  const formatSize = (bytes: number): string => {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
    return `${(bytes / 1e3).toFixed(0)} KB`
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">{lora.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1 bg-gray-700 rounded text-sm">{lora.base_model}</span>
            <span className="px-3 py-1 bg-blue-600 rounded text-sm">{lora.task_type}</span>
            <span className="px-3 py-1 bg-purple-600 rounded text-sm">{lora.category}</span>
            {lora.is_moe && (
              <span className="px-3 py-1 bg-yellow-600 rounded text-sm">MoE</span>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-gray-400 text-sm mb-1">설명</h3>
            <p className="text-white">{lora.description || '설명 없음'}</p>
          </div>

          {/* Files */}
          <div>
            <h3 className="text-gray-400 text-sm mb-2">파일 ({lora.files.length}개)</h3>
            <div className="space-y-2">
              {lora.files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-700 rounded"
                >
                  <div className="flex items-center gap-3">
                    {file.type === 'high_noise' && (
                      <span className="text-xs bg-red-600 px-2 py-0.5 rounded">HIGH</span>
                    )}
                    {file.type === 'low_noise' && (
                      <span className="text-xs bg-blue-600 px-2 py-0.5 rounded">LOW</span>
                    )}
                    <span className="text-white text-sm truncate max-w-[300px]">
                      {file.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">{formatSize(file.size)}</span>
                    {file.is_downloaded ? (
                      <span className="text-green-400 text-xs">설치됨</span>
                    ) : (
                      <span className="text-gray-500 text-xs">미설치</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Size */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">총 크기</span>
            <span className="text-white font-semibold">{formatSize(lora.total_size)}</span>
          </div>

          {/* Trigger Words */}
          {lora.trigger_words.length > 0 && (
            <div>
              <h3 className="text-gray-400 text-sm mb-2">트리거 단어</h3>
              <div className="flex gap-2 flex-wrap">
                {lora.trigger_words.map((word, idx) => (
                  <span key={idx} className="px-2 py-1 bg-gray-700 rounded text-sm">
                    {word}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Strength */}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">권장 강도</span>
            <span className="text-white">{lora.recommended_strength}</span>
          </div>

          {/* Status */}
          <div className="pt-4 border-t border-gray-700">
            {lora.all_files_downloaded ? (
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>모든 파일이 설치되어 있습니다</span>
              </div>
            ) : downloading ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{currentFile || '다운로드 중...'}</span>
                  <span className="text-white">{progress.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {error && (
                  <div className="p-2 bg-red-900/50 border border-red-700 rounded text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <button
                  onClick={handleDownload}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  다운로드
                </button>
              </div>
            )}
          </div>

          {/* File Paths (for developers) */}
          {lora.all_files_downloaded && (
            <div>
              <h3 className="text-gray-400 text-sm mb-2">파일 경로</h3>
              <div className="space-y-1">
                {lora.files.map((file, idx) => (
                  <code key={idx} className="block text-xs text-gray-500 bg-gray-900 p-2 rounded overflow-x-auto">
                    {file.path}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

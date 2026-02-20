import { useState, useRef, useCallback } from 'react'
import { LoraFilter } from '../LoraFilter'
import { LoraGrid } from '../LoraGrid'
import type { InstalledModel, LoraModel, LoraFilters } from '../../types'

interface LoraTabProps {
  models: InstalledModel[]
  loras: LoraModel[]
  loading: boolean
  filters: LoraFilters
  onFilterChange: (filters: Partial<LoraFilters>) => void
  onSelectLora: (lora: LoraModel) => void
  onDownloadComplete?: () => void
}

interface DownloadProgress {
  filename: string
  progress: number
  file_index: number
  total_files: number
}

interface UploadState {
  uploading: boolean
  progress: number
  filename: string
}

export function LoraTab({
  models,
  loras,
  loading,
  filters,
  onFilterChange,
  onSelectLora,
  onDownloadComplete
}: LoraTabProps) {
  const [urlInput, setUrlInput] = useState('')
  const [urlDownloading, setUrlDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Upload states
  const [uploadState, setUploadState] = useState<UploadState>({ uploading: false, progress: 0, filename: '' })
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get selected base model for HuggingFace URL
  const selectedModel = filters.base_model || models[0]?.name || 'LTX-2'

  // File upload handler
  const handleFileUpload = useCallback(async (file: File) => {
    const allowedExtensions = ['.safetensors', '.pt', '.pth', '.ckpt', '.bin']
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

    if (!allowedExtensions.includes(ext)) {
      setError(`지원하지 않는 파일 형식입니다. 지원: ${allowedExtensions.join(', ')}`)
      return
    }

    setUploadState({ uploading: true, progress: 0, filename: file.name })
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          setUploadState(prev => ({ ...prev, progress }))
        }
      })

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              const response = JSON.parse(xhr.responseText)
              setSuccess(`업로드 완료: ${response.filename} (${response.size_mb}MB)`)
              resolve()
            } else {
              try {
                const error = JSON.parse(xhr.responseText)
                reject(new Error(error.detail || '업로드 실패'))
              } catch {
                reject(new Error(`업로드 실패 (HTTP ${xhr.status})`))
              }
            }
          } catch (e) {
            reject(new Error('서버 응답 파싱 실패'))
          }
        }
        xhr.onerror = () => reject(new Error('네트워크 오류'))
        xhr.open('POST', '/api/loras/upload')
        xhr.send(formData)
      })

      if (onDownloadComplete) {
        onDownloadComplete()
      }
    } catch (err) {
      setError(`업로드 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setUploadState({ uploading: false, progress: 0, filename: '' })
    }
  }, [onDownloadComplete])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [handleFileUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }, [handleFileUpload])

  const getHuggingFaceUrl = () => {
    const modelSearchMap: Record<string, string> = {
      'LTX-2': 'LTX-2',
      'Wan2.2-T2V': 'Wan2.2',
      'Wan2.2-I2V': 'Wan2.2'
    }
    const search = modelSearchMap[selectedModel] || selectedModel
    return `https://huggingface.co/models?pipeline_tag=image-to-video&sort=trending&search=${encodeURIComponent(search)}`
  }

  // Handle URL download
  const handleUrlDownload = async () => {
    if (!urlInput.trim()) return

    // Validate HuggingFace URL
    if (!urlInput.includes('huggingface.co')) {
      setError('HuggingFace URL만 지원합니다')
      return
    }

    // Extract repo_id from URL
    const match = urlInput.match(/huggingface\.co\/([^\/]+\/[^\/\s?#]+)/)
    if (!match) {
      setError('올바른 HuggingFace URL 형식이 아닙니다')
      return
    }

    const repoId = match[1]
    const name = repoId.split('/')[1]

    setUrlDownloading(true)
    setError(null)
    setSuccess(null)

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/ai-search/ws/download-external`)
      wsRef.current = ws

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          ws.send(JSON.stringify({
            url: urlInput,
            repo_id: repoId,
            name: name,
            base_model: selectedModel
          }))
        }

        ws.onmessage = (event) => {
          let data
          try {
            data = JSON.parse(event.data)
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e)
            return
          }

          if (data.type === 'progress') {
            setDownloadProgress({
              filename: data.filename,
              progress: data.progress,
              file_index: data.file_index,
              total_files: data.total_files
            })
          } else if (data.type === 'complete') {
            setDownloadProgress(null)
            setUrlInput('')
            setSuccess(`${name} 다운로드 완료!`)
            resolve()
          } else if (data.type === 'error') {
            reject(new Error(data.error))
          }
        }

        ws.onerror = () => reject(new Error('WebSocket 연결 실패'))
      })

      ws.close()

      if (onDownloadComplete) {
        onDownloadComplete()
      }
    } catch (err) {
      setError(`다운로드 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
    } finally {
      setUrlDownloading(false)
      setDownloadProgress(null)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white">LoRA 관리</h2>
      </div>

      {/* Important Notice */}
      <div className="mb-6 p-4 bg-amber-900/20 border border-amber-600/50 rounded-lg">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-amber-400 mb-2">LoRA에 대한 올바른 이해</h3>
            <ul className="text-xs text-amber-200/80 space-y-1.5">
              <li>
                <span className="text-amber-400 font-medium">LoRA는 만능이 아닙니다.</span> 특정 작업(쿵푸 액션, 특정 스타일 등)에만 특화된 "전문 모드"입니다.
              </li>
              <li>
                <span className="text-amber-400 font-medium">원하는 작업에 맞는 LoRA가 없으면 무용지물.</span> 모든 상황에 맞는 LoRA가 존재하지 않습니다.
              </li>
              <li>
                <span className="text-amber-400 font-medium">프롬프트 설계가 더 중요합니다.</span> 기본 AI 모델도 다양한 작업이 가능합니다. LoRA 없이도 충분히 좋은 결과를 만들 수 있습니다.
              </li>
              <li>
                <span className="text-amber-400 font-medium">LoRA = 있으면 좋고, 없어도 됨.</span> 보조 도구로 활용하세요. LoRA에 의존하지 마세요.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* External Download Section */}
      <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          LoRA 탐색
        </h3>

        {/* Browse Links */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm text-gray-400">탐색:</span>
          <a
            href={getHuggingFaceUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 border border-yellow-600/50 text-yellow-400 text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            <img src="/logos/hugging.png" alt="HuggingFace" className="w-4 h-4" />
            HuggingFace
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a
            href="https://civitai.com/models?sortBy=models_v9&types=LORA"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 text-blue-400 text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            <img src="/logos/civit.png" alt="CivitAI" className="w-4 h-4" />
            CivitAI
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* URL Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value)
              setError(null)
              setSuccess(null)
            }}
            placeholder="HuggingFace URL 붙여넣기 (예: https://huggingface.co/user/lora-name)"
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
            disabled={urlDownloading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && urlInput.trim()) {
                handleUrlDownload()
              }
            }}
          />
          <button
            onClick={handleUrlDownload}
            disabled={!urlInput.trim() || urlDownloading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors whitespace-nowrap flex items-center gap-2"
          >
            {urlDownloading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                다운로드 중
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                서버로 다운로드
              </>
            )}
          </button>
        </div>

        {/* Progress Bar */}
        {downloadProgress && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{downloadProgress.filename} ({downloadProgress.file_index}/{downloadProgress.total_files})</span>
              <span>{downloadProgress.progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="mt-3 p-2 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 p-2 bg-green-900/30 border border-green-700 rounded text-green-400 text-sm">
            {success}
          </div>
        )}

        <p className="text-xs text-gray-500 mt-3">
          HuggingFace에서 LoRA를 찾아 URL을 복사하세요. 서버에 직접 다운로드됩니다.
        </p>
      </div>

      {/* File Upload Section */}
      <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          파일 업로드
        </h3>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".safetensors,.pt,.pth,.ckpt,.bin"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all
            ${isDragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/30'
            }
            ${uploadState.uploading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          {uploadState.uploading ? (
            <div className="space-y-3">
              <svg className="animate-spin h-8 w-8 mx-auto text-blue-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-300">{uploadState.filename} 업로드 중...</p>
              <div className="w-full max-w-xs mx-auto bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">{uploadState.progress}%</p>
            </div>
          ) : (
            <>
              <svg className="w-10 h-10 mx-auto text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-300 mb-1">
                LoRA 파일을 여기에 드래그하거나 클릭하여 선택
              </p>
              <p className="text-xs text-gray-500">
                지원 형식: .safetensors, .pt, .pth, .ckpt, .bin (최대 10GB)
              </p>
            </>
          )}
        </div>

        <p className="text-xs text-gray-500 mt-3">
          내 PC에서 다운받은 LoRA 파일을 서버에 직접 업로드합니다.
        </p>
      </div>

      {/* Filters */}
      <LoraFilter
        models={models}
        filters={filters}
        onFilterChange={onFilterChange}
      />

      {/* LoRA Grid */}
      <LoraGrid
        loras={loras}
        loading={loading}
        onSelectLora={onSelectLora}
      />
    </div>
  )
}

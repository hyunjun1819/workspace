import { useState, useEffect } from 'react'
import type { InstalledModel } from '../types'

interface ServerStatusProps {
  models: InstalledModel[]
  onRefresh: () => void
}

interface HealthStatus {
  comfyui: boolean
  gemini_configured: boolean
}

export function ServerStatus({ models, onRefresh }: ServerStatusProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/health')
        if (res.ok) {
          const data = await res.json()
          setHealth({ comfyui: data.comfyui, gemini_configured: data.gemini_configured })
        } else {
          setHealth({ comfyui: false, gemini_configured: false })
        }
      } catch {
        setHealth({ comfyui: false, gemini_configured: false })
      }
    }
    checkHealth()
    const interval = setInterval(checkHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const comfyuiConnected = health?.comfyui ?? false

  const getTaskBadge = (model: InstalledModel) => {
    const tasks = []
    if (model.supports_t2v) tasks.push('T2V')
    if (model.supports_i2v) tasks.push('I2V')
    return tasks.join(' + ')
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${comfyuiConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-white font-semibold">
              {comfyuiConnected ? 'ComfyUI 연결됨' : 'ComfyUI 연결 안됨'}
            </span>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
        >
          모델 재감지
        </button>
      </div>

      {/* Installed Models */}
      <div>
        <h3 className="text-gray-400 text-sm mb-2">설치된 비디오 모델:</h3>

        {models.length === 0 && (
          <div className="text-yellow-400 text-sm">
            비디오 모델이 감지되지 않았습니다. ComfyUI에 모델을 설치해주세요.
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          {models.map((model) => (
            <div
              key={model.name}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg border border-gray-600"
            >
              <span className="font-semibold text-white">
                {model.display_name}
              </span>

              <span className="text-xs bg-blue-600 px-2 py-0.5 rounded">
                {getTaskBadge(model)}
              </span>

              {model.is_moe && (
                <span className="text-xs bg-purple-600 px-2 py-0.5 rounded">
                  MoE
                </span>
              )}

              {!model.is_complete && (
                <span className="text-xs bg-red-600 px-2 py-0.5 rounded">
                  불완전
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

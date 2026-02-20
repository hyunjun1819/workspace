import { useState, useEffect } from 'react'
import { ServerStatus } from '../ServerStatus'
import type { InstalledModel } from '../../types'

interface SettingsTabProps {
  models: InstalledModel[]
  onRefresh: () => void
}

interface HealthStatus {
  comfyui: boolean
  gemini_configured: boolean
}

export function SettingsTab({ models, onRefresh }: SettingsTabProps) {
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

  const StatusDot = ({ ok }: { ok: boolean }) => (
    <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`}></span>
  )

  return (
    <div className="space-y-6">
      {/* Server Status */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">서버 상태</h2>
        <ServerStatus models={models} onRefresh={onRefresh} />
      </div>

      {/* Path Settings */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">경로 설정</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">ComfyUI 경로</span>
            <span className="text-white font-mono text-sm bg-gray-700 px-3 py-1 rounded">
              /opt/comfyui-server
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-400">LoRA 경로</span>
            <span className="text-white font-mono text-sm bg-gray-700 px-3 py-1 rounded">
              /opt/comfyui-server/models/loras
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-400">UNET 경로</span>
            <span className="text-white font-mono text-sm bg-gray-700 px-3 py-1 rounded">
              /opt/comfyui-server/models/unet
            </span>
          </div>
        </div>
      </div>

      {/* API Settings */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">API 설정</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Gemini API</span>
            <span className={`text-sm flex items-center gap-2 ${health?.gemini_configured ? 'text-green-400' : 'text-red-400'}`}>
              <StatusDot ok={health?.gemini_configured ?? false} />
              {health === null ? '확인 중...' : health.gemini_configured ? '설정됨' : '미설정'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-400">ComfyUI API</span>
            <span className={`text-sm flex items-center gap-2 ${health?.comfyui ? 'text-green-400' : 'text-red-400'}`}>
              <StatusDot ok={health?.comfyui ?? false} />
              {health === null ? '확인 중...' : health.comfyui ? ':8188 연결됨' : ':8188 연결 안됨'}
            </span>
          </div>
        </div>
      </div>

      {/* Version Info */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">버전 정보</h3>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Video LoRA Manager</span>
            <span className="text-white">v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}

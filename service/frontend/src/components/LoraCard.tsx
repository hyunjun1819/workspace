import { useState } from 'react'
import type { LoraModel } from '../types'

interface LoraCardProps {
  lora: LoraModel
  onClick: () => void
}

// Camera LoRA to video file mapping
const CAMERA_VIDEO_MAP: Record<string, string> = {
  'dolly-in': '/videos/textIn.mp4',
  'dolly-left': '/videos/textLeft.mp4',
  'dolly-out': '/videos/textOut.mp4',
  'dolly-right': '/videos/testRight.mp4',
  'jib-up': '/videos/textJibup.mp4',
  'static': '/videos/textStatic.mp4',
}

function getCameraVideoUrl(loraName: string): string | null {
  const nameLower = loraName.toLowerCase()

  if (nameLower.includes('dolly-in') || nameLower.includes('dolly in')) {
    return CAMERA_VIDEO_MAP['dolly-in']
  }
  if (nameLower.includes('dolly-left') || nameLower.includes('dolly left')) {
    return CAMERA_VIDEO_MAP['dolly-left']
  }
  if (nameLower.includes('dolly-out') || nameLower.includes('dolly out')) {
    return CAMERA_VIDEO_MAP['dolly-out']
  }
  if (nameLower.includes('dolly-right') || nameLower.includes('dolly right')) {
    return CAMERA_VIDEO_MAP['dolly-right']
  }
  if (nameLower.includes('jib-up') || nameLower.includes('jib up')) {
    return CAMERA_VIDEO_MAP['jib-up']
  }
  if (nameLower.includes('static')) {
    return CAMERA_VIDEO_MAP['static']
  }

  return null
}

export function LoraCard({ lora, onClick }: LoraCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const formatSize = (bytes: number): string => {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
    return `${(bytes / 1e3).toFixed(0)} KB`
  }

  const getTaskColor = (taskType: string): string => {
    switch (taskType) {
      case 'T2V':
        return 'bg-green-600'
      case 'I2V':
        return 'bg-orange-600'
      case 'BOTH':
        return 'bg-blue-600'
      default:
        return 'bg-gray-600'
    }
  }

  const getTaskLabel = (taskType: string): string => {
    switch (taskType) {
      case 'T2V':
        return '텍스트→영상'
      case 'I2V':
        return '이미지→영상'
      case 'BOTH':
        return '공통'
      default:
        return taskType
    }
  }

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'lightning':
        return 'bg-yellow-600'
      case 'distilled':
        return 'bg-purple-600'
      case 'camera':
        return 'bg-cyan-600'
      case 'style':
        return 'bg-pink-600'
      default:
        return 'bg-gray-600'
    }
  }

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'camera':
        return '카메라 제어'
      case 'distilled':
        return '고속 생성'
      case 'lightning':
        return '초고속'
      case 'style':
        return '스타일'
      default:
        return category
    }
  }

  // Get video URL for camera LoRAs
  const cameraVideoUrl = lora.category === 'camera' ? getCameraVideoUrl(lora.name) : null

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500 transition-all cursor-pointer group h-full"
    >
      {/* Thumbnail / Video Preview */}
      <div className="h-28 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-4xl group-hover:scale-105 transition-transform overflow-hidden relative">
        {cameraVideoUrl ? (
          <video
            src={cameraVideoUrl}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
            autoPlay={isHovered}
            ref={(el) => {
              if (el) {
                if (isHovered) {
                  el.play().catch(() => {})
                } else {
                  el.pause()
                  el.currentTime = 0
                }
              }
            }}
          />
        ) : lora.thumbnail ? (
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `url(${lora.thumbnail})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        ) : (
          <span>{lora.is_moe ? '🎬' : '🎥'}</span>
        )}
      </div>

      {/* Compact Content */}
      <div className="p-2">
        {/* Badges */}
        <div className="flex gap-1 flex-wrap mb-2">
          <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded">
            {lora.base_model}
          </span>
          <span className={`text-xs ${getTaskColor(lora.task_type)} px-1.5 py-0.5 rounded`}>
            {getTaskLabel(lora.task_type)}
          </span>
          <span className={`text-xs ${getCategoryColor(lora.category)} px-1.5 py-0.5 rounded`}>
            {getCategoryLabel(lora.category)}
          </span>
        </div>

        {/* MoE Indicator */}
        {lora.is_moe && (
          <div className="flex items-center gap-1 text-xs text-purple-400 mb-1">
            <span className="w-2 h-2 bg-purple-500 rounded-full" />
            <span>2파일 필요</span>
          </div>
        )}

        {/* Size and Status */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{formatSize(lora.total_size)}</span>

          {lora.all_files_downloaded ? (
            <span className="text-green-400 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              설치됨
            </span>
          ) : (
            <span className="text-gray-500">미설치</span>
          )}
        </div>
      </div>
    </div>
  )
}

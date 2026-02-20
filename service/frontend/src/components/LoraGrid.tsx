import type { LoraModel } from '../types'
import { LoraCard } from './LoraCard'

interface LoraGridProps {
  loras: LoraModel[]
  loading: boolean
  onSelectLora: (lora: LoraModel) => void
}

export function LoraGrid({ loras, loading, onSelectLora }: LoraGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    )
  }

  if (loras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
        <p>조건에 맞는 LoRA가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {loras.map((lora) => (
        <div
          key={lora.id}
          className="flex gap-4 bg-gray-800/50 border border-gray-700 rounded-lg p-3 hover:border-blue-500 transition-colors"
        >
          {/* Card (left) */}
          <div className="w-48 flex-shrink-0">
            <LoraCard
              lora={lora}
              onClick={() => onSelectLora(lora)}
            />
          </div>

          {/* Description (right) */}
          <div className="flex-1 flex flex-col justify-center py-2">
            <h3 className="text-white font-semibold mb-2">{lora.name}</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              {lora.description}
            </p>

            {/* Trigger words if any */}
            {lora.trigger_words && lora.trigger_words.length > 0 && (
              <div className="mt-3">
                <span className="text-xs text-gray-500">트리거 워드: </span>
                <span className="text-xs text-blue-400">
                  {lora.trigger_words.join(', ')}
                </span>
              </div>
            )}

            {/* Recommended strength - hide if default (1) */}
            {lora.recommended_strength && lora.recommended_strength !== 1 && (
              <div className="mt-1">
                <span className="text-xs text-gray-500">권장 강도: </span>
                <span className="text-xs text-green-400">
                  {lora.recommended_strength}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

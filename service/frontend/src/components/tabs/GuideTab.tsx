import { useState } from 'react'

type ModeType = 't2v' | 'i2v' | 'fef2v'

interface ModeInfo {
  id: ModeType
  name: string
  fullName: string
  inputIcon: string
  inputLabel: string
  inputExample: string
  outputIcon: string
  outputLabel: string
  description: string
  useCases: string[]
  color: string
  videoFile?: string
  inputImage?: string
  endImage?: string
}

interface CameraLora {
  id: string
  name: string
  desc: string
  videoFile: string
}

const modes: ModeInfo[] = [
  {
    id: 't2v',
    name: 'T2V',
    fullName: 'Text to Video',
    inputIcon: '📝',
    inputLabel: '텍스트',
    inputExample: '"A cat walking in a garden"',
    outputIcon: '🎥',
    outputLabel: '비디오',
    description: '텍스트 프롬프트만으로 비디오를 생성합니다. 아이디어를 직접 영상으로 만들 수 있습니다.',
    useCases: [
      '아이디어만 있고 참고 이미지가 없을 때',
      '완전히 새로운 장면을 만들고 싶을 때',
      '빠르게 컨셉을 테스트하고 싶을 때',
    ],
    color: 'blue',
    videoFile: 't2vcat.mp4',
  },
  {
    id: 'i2v',
    name: 'I2V',
    fullName: 'Image to Video',
    inputIcon: '🖼️',
    inputLabel: '이미지 + 텍스트',
    inputExample: '"A Lamborghini races at high speed and drifts"',
    outputIcon: '🎥',
    outputLabel: '비디오',
    description: '이미지를 기반으로 움직이는 비디오를 생성합니다. 정적인 이미지에 생명을 불어넣습니다.',
    useCases: [
      '특정 이미지를 움직이게 하고 싶을 때',
      '사진에서 시작하는 영상이 필요할 때',
      '일관된 캐릭터/장면을 유지하고 싶을 때',
    ],
    color: 'green',
    videoFile: 'i2vcar.mp4',
    inputImage: 'lam.jpg',
  },
  {
    id: 'fef2v',
    name: 'FEF2V',
    fullName: 'First & End Frame to Video',
    inputIcon: '🖼️',
    inputLabel: '첫 프레임 + 끝 프레임 + 텍스트',
    inputExample: '"A video of flowers blooming on a building"',
    outputIcon: '🎥',
    outputLabel: '비디오',
    description: '첫 프레임과 끝 프레임 이미지를 기반으로 그 사이를 자연스럽게 연결하는 비디오를 생성합니다.',
    useCases: [
      '시작과 끝 장면이 정해져 있을 때',
      '모핑/변환 효과가 필요할 때',
      '스토리보드 기반 영상 제작 시',
    ],
    color: 'purple',
    videoFile: 'FEF2V.mp4',
    inputImage: '시작.png',
    endImage: '끝.png',
  },
]

const cameraLoras: CameraLora[] = [
  { id: 'dolly-in', name: 'Dolly In', desc: '피사체로 전진', videoFile: 'textIn.mp4' },
  { id: 'dolly-out', name: 'Dolly Out', desc: '피사체에서 후진', videoFile: 'textOut.mp4' },
  { id: 'dolly-left', name: 'Dolly Left', desc: '왼쪽으로 이동', videoFile: 'textLeft.mp4' },
  { id: 'dolly-right', name: 'Dolly Right', desc: '오른쪽으로 이동', videoFile: 'testRight.mp4' },
  { id: 'jib-up', name: 'Jib Up', desc: '위로 이동 (크레인)', videoFile: 'textJibup.mp4' },
  { id: 'static', name: 'Static', desc: '카메라 고정', videoFile: 'textStatic.mp4' },
]

const CAMERA_PROMPT = 'A person walking in a forest, cinematic lighting, 4K'

export function GuideTab() {
  const [activeMode, setActiveMode] = useState<ModeType>('t2v')
  const [selectedLora, setSelectedLora] = useState<CameraLora | null>(null)
  const [showUpscaleModal, setShowUpscaleModal] = useState(false)
  const [showModeVideoModal, setShowModeVideoModal] = useState(false)

  const currentMode = modes.find(m => m.id === activeMode)!

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { active: string; inactive: string; bg: string }> = {
      blue: {
        active: 'bg-blue-600 text-white border-blue-600',
        inactive: 'text-blue-400 border-blue-600/30 hover:border-blue-500',
        bg: 'bg-blue-600/20 border-blue-500/50',
      },
      green: {
        active: 'bg-green-600 text-white border-green-600',
        inactive: 'text-green-400 border-green-600/30 hover:border-green-500',
        bg: 'bg-green-600/20 border-green-500/50',
      },
      purple: {
        active: 'bg-purple-600 text-white border-purple-600',
        inactive: 'text-purple-400 border-purple-600/30 hover:border-purple-500',
        bg: 'bg-purple-600/20 border-purple-500/50',
      },
    }
    return isActive ? colors[color].active : colors[color].inactive
  }

  return (
    <div className="space-y-8">
      {/* Mode Guide Section */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6">어떤 모드를 사용할까요?</h2>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-6">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`
                px-6 py-3 rounded-lg border-2 font-semibold transition-all
                ${getColorClasses(mode.color, activeMode === mode.id)}
              `}
            >
              <div className="text-lg">{mode.name}</div>
              <div className="text-xs opacity-80">{mode.fullName}</div>
            </button>
          ))}
        </div>

        {/* Mode Content */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Visual Flow */}
          <div className="flex items-center justify-center gap-4 p-8 bg-gray-900 rounded-lg">
            {/* Input */}
            <div className="text-center">
              {currentMode.endImage ? (
                // FEF2V: Two images (first + end frame)
                <div className="flex gap-2">
                  <div className={`
                    w-24 h-24 rounded-xl border-2 overflow-hidden
                    ${getColorClasses(currentMode.color, false).replace('hover:border-', 'border-')}
                  `}>
                    <img
                      src={`/videos/${currentMode.inputImage}`}
                      alt="첫 프레임"
                      className="w-full h-full object-cover"
                    />
                    <div className="text-xs text-gray-400 mt-1">첫 프레임</div>
                  </div>
                  <div className={`
                    w-24 h-24 rounded-xl border-2 overflow-hidden
                    ${getColorClasses(currentMode.color, false).replace('hover:border-', 'border-')}
                  `}>
                    <img
                      src={`/videos/${currentMode.endImage}`}
                      alt="끝 프레임"
                      className="w-full h-full object-cover"
                    />
                    <div className="text-xs text-gray-400 mt-1">끝 프레임</div>
                  </div>
                </div>
              ) : currentMode.inputImage ? (
                <div className={`
                  w-32 h-32 rounded-xl border-2 overflow-hidden
                  ${getColorClasses(currentMode.color, false).replace('hover:border-', 'border-')}
                `}>
                  <img
                    src={`/videos/${currentMode.inputImage}`}
                    alt={currentMode.inputLabel}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className={`
                  w-32 h-32 rounded-xl border-2 flex flex-col items-center justify-center
                  ${getColorClasses(currentMode.color, false).replace('hover:border-', 'border-')} bg-gray-800
                `}>
                  <span className="text-4xl mb-2">{currentMode.inputIcon}</span>
                  <span className="text-sm text-gray-300">{currentMode.inputLabel}</span>
                </div>
              )}
              <p className="text-sm text-gray-400 mt-3 max-w-36 leading-relaxed">
                {currentMode.inputExample}
              </p>
            </div>

            {/* Arrow */}
            <div className="text-3xl text-gray-500">→</div>

            {/* Output */}
            <div className="text-center">
              {currentMode.videoFile ? (
                <button
                  onClick={() => setShowModeVideoModal(true)}
                  className={`
                    w-32 h-32 rounded-xl border-2 overflow-hidden cursor-pointer
                    hover:ring-2 hover:ring-blue-400 transition-all
                    ${getColorClasses(currentMode.color, true)}
                  `}
                >
                  <video
                    src={`/videos/${currentMode.videoFile}`}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  />
                </button>
              ) : (
                <div className={`
                  w-32 h-32 rounded-xl border-2 flex flex-col items-center justify-center
                  ${getColorClasses(currentMode.color, true)}
                `}>
                  <span className="text-4xl mb-2">{currentMode.outputIcon}</span>
                  <span className="text-sm">{currentMode.outputLabel}</span>
                </div>
              )}
              <p className="text-sm text-gray-400 mt-3">
                {currentMode.videoFile ? (
                  <span>클릭하여 확대 <span className="text-blue-400">▶</span></span>
                ) : (
                  '생성된 영상'
                )}
              </p>
            </div>
          </div>

          {/* Description & Use Cases */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {currentMode.fullName}
              </h3>
              <p className="text-gray-300">
                {currentMode.description}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">
                💡 이럴 때 사용하세요
              </h4>
              <ul className="space-y-2">
                {currentMode.useCases.map((useCase, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-300 text-sm">
                    <span className="text-gray-500 mt-0.5">•</span>
                    {useCase}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Camera LoRA Guide */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-2">📹 카메라 LoRA 가이드</h2>
        <p className="text-gray-400 text-sm mb-4">
          카메라 움직임을 제어하는 6가지 LoRA입니다. 클릭하면 예시 영상을 확인할 수 있습니다.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {cameraLoras.map((lora) => (
            <button
              key={lora.id}
              onClick={() => setSelectedLora(lora)}
              className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 text-center hover:bg-gray-700 hover:border-blue-500 transition-all cursor-pointer"
            >
              <div className="text-2xl mb-2">🎥</div>
              <div className="text-white font-medium text-sm">{lora.name}</div>
              <div className="text-gray-400 text-xs mt-1">{lora.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Upscale Guide */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-2">🔍 업스케일 가이드</h2>
        <p className="text-gray-400 text-sm mb-4">
          생성된 영상의 해상도를 높여 더 선명한 결과물을 만들 수 있습니다.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Before/After Comparison */}
          <button
            onClick={() => setShowUpscaleModal(true)}
            className="bg-gray-900 rounded-lg p-4 hover:bg-gray-900/80 hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer text-left w-full"
          >
            <h3 className="text-white font-semibold mb-3">원본 vs 업스케일 <span className="text-blue-400 text-xs font-normal ml-2">클릭하여 확대</span></h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="bg-gray-700 rounded-lg aspect-video flex items-center justify-center mb-2 overflow-hidden">
                  <video
                    src="/videos/testRight.mp4"
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  />
                </div>
                <span className="text-gray-400 text-xs">원본 (480p)</span>
              </div>
              <div className="text-center">
                <div className="bg-gray-700 rounded-lg aspect-video flex items-center justify-center mb-2 overflow-hidden">
                  <video
                    src="/videos/textRight_Upscale.mp4"
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                  />
                </div>
                <span className="text-green-400 text-xs">업스케일 (1080p)</span>
              </div>
            </div>
          </button>

          {/* Upscale Info */}
          <div className="space-y-4">
            <div>
              <h4 className="text-white font-semibold mb-2">업스케일이란?</h4>
              <p className="text-gray-300 text-sm">
                AI를 활용하여 저해상도 영상을 고해상도로 변환하는 기술입니다.
                단순 확대가 아닌 디테일을 복원하여 선명한 결과물을 만듭니다.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">
                💡 이럴 때 사용하세요
              </h4>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-gray-300 text-sm">
                  <span className="text-gray-500 mt-0.5">•</span>
                  최종 결과물의 품질을 높이고 싶을 때
                </li>
                <li className="flex items-start gap-2 text-gray-300 text-sm">
                  <span className="text-gray-500 mt-0.5">•</span>
                  SNS나 유튜브에 업로드할 영상이 필요할 때
                </li>
                <li className="flex items-start gap-2 text-gray-300 text-sm">
                  <span className="text-gray-500 mt-0.5">•</span>
                  세부 디테일이 중요한 작업물일 때
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Camera LoRA Modal */}
      {selectedLora && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLora(null)}
        >
          <div
            className="bg-gray-800 rounded-xl max-w-2xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedLora.name}</h3>
                <p className="text-gray-400 text-sm">{selectedLora.desc}</p>
              </div>
              <button
                onClick={() => setSelectedLora(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Video */}
            <div className="p-4">
              <video
                src={`/videos/${selectedLora.videoFile}`}
                className="w-full rounded-lg"
                controls
                autoPlay
                loop
              />
            </div>

            {/* Prompt Info */}
            <div className="p-4 border-t border-gray-700 bg-gray-900">
              <div className="text-sm text-gray-400 mb-1">사용된 프롬프트</div>
              <div className="bg-gray-800 rounded-lg p-3 font-mono text-sm text-green-400">
                {CAMERA_PROMPT}
              </div>
              <div className="mt-3 text-xs text-gray-500">
                LoRA: ltx-2-19b-lora-camera-control-{selectedLora.id}.safetensors
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upscale Comparison Modal */}
      {showUpscaleModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowUpscaleModal(false)}
        >
          <div
            className="bg-gray-800 rounded-xl max-w-5xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-white">원본 vs 업스케일 비교</h3>
                <p className="text-gray-400 text-sm">동일한 영상의 해상도 차이를 비교해보세요</p>
              </div>
              <button
                onClick={() => setShowUpscaleModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Videos Side by Side */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="bg-gray-900 rounded-lg overflow-hidden mb-3">
                    <video
                      src="/videos/testRight.mp4"
                      className="w-full"
                      controls
                      autoPlay
                      loop
                      muted
                    />
                  </div>
                  <div className="inline-block bg-gray-700 rounded-full px-4 py-1">
                    <span className="text-gray-300 font-medium">원본</span>
                    <span className="text-gray-500 text-sm ml-2">480p</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-gray-900 rounded-lg overflow-hidden mb-3">
                    <video
                      src="/videos/textRight_Upscale.mp4"
                      className="w-full"
                      controls
                      autoPlay
                      loop
                      muted
                    />
                  </div>
                  <div className="inline-block bg-green-600/30 border border-green-500/50 rounded-full px-4 py-1">
                    <span className="text-green-400 font-medium">업스케일</span>
                    <span className="text-green-500/70 text-sm ml-2">1080p</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="p-4 border-t border-gray-700 bg-gray-900">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">해상도 향상:</span>
                  <span className="text-green-400 font-medium">480p → 1080p (2.25x)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">사용 모델:</span>
                  <span className="text-blue-400">Real-ESRGAN x4</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode Video Modal */}
      {showModeVideoModal && currentMode.videoFile && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModeVideoModal(false)}
        >
          <div
            className="bg-gray-800 rounded-xl max-w-4xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-white">{currentMode.fullName} 결과</h3>
                <p className="text-gray-400 text-sm">{currentMode.description}</p>
              </div>
              <button
                onClick={() => setShowModeVideoModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Video */}
            <div className="p-4">
              <video
                src={`/videos/${currentMode.videoFile}`}
                className="w-full rounded-lg"
                controls
                autoPlay
                loop
              />
            </div>

            {/* Prompt Info */}
            <div className="p-4 border-t border-gray-700 bg-gray-900">
              <div className="text-sm text-gray-400 mb-1">사용된 프롬프트</div>
              <div className="bg-gray-800 rounded-lg p-3 font-mono text-sm text-green-400">
                {currentMode.inputExample}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

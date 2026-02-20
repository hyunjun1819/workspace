import { useState } from 'react'

// 복사 버튼 컴포넌트
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
    >
      {copied ? '✅ 복사됨!' : '📋 복사'}
    </button>
  )
}

// 코드 블록 컴포넌트
function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="relative">
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      {!label && (
        <div className="absolute top-2 right-2">
          <CopyButton text={code} />
        </div>
      )}
      <pre className="bg-gray-900 border border-gray-600 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}

// AI 프롬프트 변환기 컴포넌트
function PromptConverter({ modelType, accentColor }: { modelType: 'wan2.2' | 'ltx2'; accentColor: string }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ prompt: string; negative: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleConvert = async () => {
    if (!input.trim()) {
      setError('프롬프트를 입력해주세요')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/tips/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_type: modelType,
          user_prompt: input
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || '변환 실패')
      }

      const data = await res.json()
      setResult({
        prompt: data.converted_prompt,
        negative: data.negative_prompt
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '서버 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const borderColor = accentColor === 'blue' ? 'border-blue-700/50' : 'border-purple-700/50'
  const bgColor = accentColor === 'blue' ? 'bg-blue-900/20' : 'bg-purple-900/20'
  const textColor = accentColor === 'blue' ? 'text-blue-400' : 'text-purple-400'
  const buttonBg = accentColor === 'blue' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'

  return (
    <div className={`mt-6 p-4 ${bgColor} border ${borderColor} rounded-lg`}>
      <h4 className={`${textColor} font-semibold mb-3 flex items-center gap-2`}>
        🤖 AI 프롬프트 변환기
        <span className="text-xs text-gray-500 font-normal">Gemini 기반</span>
      </h4>

      {/* 입력 영역 */}
      <div className="mb-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="원하는 영상을 설명해주세요&#10;예: 30대 여성이 카페에서 커피를 마시며 미소짓는 영상"
          className="w-full h-24 bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-500 resize-none"
          disabled={loading}
        />
      </div>

      {/* 변환 버튼 */}
      <button
        onClick={handleConvert}
        disabled={loading || !input.trim()}
        className={`w-full py-2 px-4 ${buttonBg} text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
      >
        {loading ? (
          <>
            <span className="animate-spin">⏳</span>
            변환 중...
          </>
        ) : (
          <>
            🎬 실사 프롬프트로 변환
          </>
        )}
      </button>

      {/* 에러 메시지 */}
      {error && (
        <div className="mt-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      {/* 결과 영역 */}
      {result && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">✨ 변환된 프롬프트</span>
              <CopyButton text={result.prompt} />
            </div>
            <pre className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-green-300 whitespace-pre-wrap">
              {result.prompt}
            </pre>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">🚫 네거티브 프롬프트</span>
              <CopyButton text={result.negative} />
            </div>
            <pre className="bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-red-300 whitespace-pre-wrap">
              {result.negative}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// 프롬프트 데이터
const WAN_MASTER_PROMPT = `visible skin pores; fine microtexture; natural imperfections;
subtle freckles; faint smile lines; realistic sheen on highlights;
not an airbrushed look`

const WAN_LIGHTING = `soft diffused lighting, gentle side lighting, warm side lighting,
rim lighting, edge lighting`

const WAN_LENS = `85mm portrait lens, shallow depth of field, cinematic bokeh,
close-up, medium close-up`

const WAN_NEGATIVE = `smooth skin, plastic skin, waxy face, doll-like, overly processed,
airbrushed, bright colors, overexposed`

const WAN_FULL_TEMPLATE = `[인종/나이] adult with natural skin texture, visible pores,
and [피부상태: subtle makeup / uneven skin tone / faint wrinkles],
wearing [의상]. [환경].
Soft diffused lighting with rim light on face,
85mm lens with shallow depth of field.
Camera slowly [움직임: pushes forward / pans left].
Kodak Portra color grading, cinematic mood.

Negative: plastic skin, airbrushed, overly smooth, doll-like,
waxy face, low quality, overexposed`

const LTX_MASTER_PROMPT = `skin texture detailed, authentic skin texture, skin-tone accurate,
high resolution, crisp detail, no mushy surfaces, pore detail,
minimal micro-jitter`

const LTX_LIGHTING = `strong natural sunlight hitting from the side,
key light 45° softbox feel, soft rim light,
edge/rim light separation, golden-hour bounce`

const LTX_LENS = `50mm f/2.8, 100mm macro f/4, 35mm f/2.0`

const LTX_NEGATIVE = `jitter, texture shifts, duplication, plastic skin, blur artifacts,
high-frequency patterns, motion blur artifacts, oversaturation`

const LTX_FULL_TEMPLATE = `[인종/나이] [성별] person with authentic skin texture,
visible pores and natural imperfections, [의상/외모].
[환경 설정]. Strong natural sunlight from side creating
realistic highlights on skin. [렌즈: 50mm f/2.8 / 85mm f/2.0],
shallow depth of field. [카메라: Slow dolly in / static tripod-locked].
Kodak Portra aesthetic, desaturated cinema look, 24fps,
180-degree shutter, natural motion blur.

Avoid: jitter, plastic skin, blur artifacts, high-frequency patterns,
texture shifts, oversaturation`

export function TipsTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-2">🎬 피부 현실성 프롬프트 가이드</h2>
        <p className="text-gray-400">
          Wan2.2와 LTX2에서 실제 사람 피부처럼 생성하는 트리거 문장 모음
        </p>
      </div>

      {/* 공통 원칙 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">⚡ 핵심 원칙 5가지</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
            <span className="text-red-400 font-semibold">❌ "beautiful/perfect" 금지</span>
            <span className="text-gray-400 text-sm ml-2">→ "natural/unposed" 사용</span>
          </div>
          <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3">
            <span className="text-green-400 font-semibold">✅ 불완전성 = 현실성</span>
            <span className="text-gray-400 text-sm ml-2">→ pores, dryness, uneven tone</span>
          </div>
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
            <span className="text-yellow-400 font-semibold">💡 조명이 피부를 만든다</span>
            <span className="text-gray-400 text-sm ml-2">→ 소프트 조명 + 림 라이트</span>
          </div>
          <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
            <span className="text-blue-400 font-semibold">📷 렌즈 스펙 = 품질</span>
            <span className="text-gray-400 text-sm ml-2">→ 특히 LTX2에서 필수</span>
          </div>
          <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-3 md:col-span-2">
            <span className="text-purple-400 font-semibold">🛡️ 네거티브 = 방어선</span>
            <span className="text-gray-400 text-sm ml-2">→ plastic, airbrushed 반드시 제거</span>
          </div>
        </div>
      </div>

      {/* Wan2.2 섹션 */}
      <div className="bg-gray-800 border border-blue-700/50 rounded-lg p-6">
        <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">W</span>
          Wan2.2 피부 트리거
        </h3>

        {/* 핵심 키워드 테이블 */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">핵심 트리거 키워드</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left py-2 px-3 text-gray-400">카테고리</th>
                  <th className="text-left py-2 px-3 text-gray-400">트리거 키워드</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-3 text-blue-400">모공/텍스처</td>
                  <td className="py-2 px-3"><code className="bg-gray-700 px-1 rounded">visible pores</code>, <code className="bg-gray-700 px-1 rounded">detailed skin texture</code>, <code className="bg-gray-700 px-1 rounded">fine microtexture</code></td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-3 text-blue-400">불완전성</td>
                  <td className="py-2 px-3"><code className="bg-gray-700 px-1 rounded">natural imperfections</code>, <code className="bg-gray-700 px-1 rounded">subtle freckles</code>, <code className="bg-gray-700 px-1 rounded">faint smile lines</code></td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-3 text-blue-400">광택</td>
                  <td className="py-2 px-3"><code className="bg-gray-700 px-1 rounded">realistic sheen on highlights</code>, <code className="bg-gray-700 px-1 rounded">slight shine on forehead</code></td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-blue-400">부정 제거</td>
                  <td className="py-2 px-3"><code className="bg-gray-700 px-1 rounded">not airbrushed</code>, <code className="bg-gray-700 px-1 rounded">natural skin</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 프롬프트들 */}
        <div className="space-y-4">
          <CodeBlock code={WAN_MASTER_PROMPT} label="🎯 마스터 프롬프트" />
          <CodeBlock code={WAN_LIGHTING} label="💡 조명 트리거" />
          <CodeBlock code={WAN_LENS} label="📷 카메라/렌즈 트리거" />
          <CodeBlock code={WAN_NEGATIVE} label="🚫 네거티브 프롬프트 (필수)" />
        </div>

        {/* 완전체 템플릿 */}
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <h4 className="text-blue-400 font-semibold mb-3">📋 완전체 템플릿</h4>
          <CodeBlock code={WAN_FULL_TEMPLATE} />
        </div>

        {/* AI 변환기 */}
        <PromptConverter modelType="wan2.2" accentColor="blue" />
      </div>

      {/* LTX2 섹션 */}
      <div className="bg-gray-800 border border-purple-700/50 rounded-lg p-6">
        <h3 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">L</span>
          LTX2 피부 트리거
        </h3>

        {/* 핵심 키워드 테이블 */}
        <div className="mb-6">
          <h4 className="text-white font-semibold mb-3">핵심 트리거 키워드</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="text-left py-2 px-3 text-gray-400">카테고리</th>
                  <th className="text-left py-2 px-3 text-gray-400">트리거 키워드</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-3 text-purple-400">마크로</td>
                  <td className="py-2 px-3"><code className="bg-gray-700 px-1 rounded">macro shot</code>, <code className="bg-gray-700 px-1 rounded">extreme close-up</code>, <code className="bg-gray-700 px-1 rounded">100mm macro</code></td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-3 text-purple-400">텍스처</td>
                  <td className="py-2 px-3"><code className="bg-gray-700 px-1 rounded">skin texture macro shot</code>, <code className="bg-gray-700 px-1 rounded">authentic skin texture</code>, <code className="bg-gray-700 px-1 rounded">crisp detail</code></td>
                </tr>
                <tr className="border-b border-gray-700">
                  <td className="py-2 px-3 text-purple-400">품질</td>
                  <td className="py-2 px-3"><code className="bg-gray-700 px-1 rounded">high resolution</code>, <code className="bg-gray-700 px-1 rounded">pore detail</code>, <code className="bg-gray-700 px-1 rounded">no mushy surfaces</code></td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-purple-400">안정성</td>
                  <td className="py-2 px-3"><code className="bg-gray-700 px-1 rounded">minimal micro-jitter</code>, <code className="bg-gray-700 px-1 rounded">no shimmer</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 프롬프트들 */}
        <div className="space-y-4">
          <CodeBlock code={LTX_MASTER_PROMPT} label="🎯 마스터 프롬프트" />
          <CodeBlock code={LTX_LIGHTING} label="💡 조명 트리거" />
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-400">📷 렌즈 스펙 트리거</span>
              <span className="px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded">품질 17% 향상</span>
            </div>
            <CodeBlock code={LTX_LENS} />
          </div>
          <CodeBlock code={LTX_NEGATIVE} label="🚫 네거티브 프롬프트 (필수)" />
        </div>

        {/* 완전체 템플릿 */}
        <div className="mt-6 p-4 bg-purple-900/20 border border-purple-700/50 rounded-lg">
          <h4 className="text-purple-400 font-semibold mb-3">📋 완전체 템플릿</h4>
          <CodeBlock code={LTX_FULL_TEMPLATE} />
        </div>

        {/* AI 변환기 */}
        <PromptConverter modelType="ltx2" accentColor="purple" />
      </div>

      {/* 모델별 비교표 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">📊 모델별 비교</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left py-2 px-3 text-gray-400">항목</th>
                <th className="text-left py-2 px-3 text-blue-400">Wan2.2</th>
                <th className="text-left py-2 px-3 text-purple-400">LTX2</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-gray-700">
                <td className="py-2 px-3">최적 해상도</td>
                <td className="py-2 px-3">480P/720P</td>
                <td className="py-2 px-3">480×720 (초기), 고해상도</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-2 px-3">프레임레이트</td>
                <td className="py-2 px-3">24fps (시네마틱)</td>
                <td className="py-2 px-3">24fps</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-2 px-3">권장 길이</td>
                <td className="py-2 px-3">5초 이내, 120프레임</td>
                <td className="py-2 px-3">짧을수록 안정적</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-2 px-3">프롬프트 길이</td>
                <td className="py-2 px-3">80-120단어</td>
                <td className="py-2 px-3">200자 이하</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-2 px-3">피부 강점</td>
                <td className="py-2 px-3">MoE로 디테일 보존 우수</td>
                <td className="py-2 px-3">마크로 텍스처 우수</td>
              </tr>
              <tr className="border-b border-gray-700">
                <td className="py-2 px-3">렌즈 명시</td>
                <td className="py-2 px-3">선택적 (있으면 좋음)</td>
                <td className="py-2 px-3"><span className="text-green-400 font-semibold">필수 (품질 17% 향상)</span></td>
              </tr>
              <tr>
                <td className="py-2 px-3">네거티브</td>
                <td className="py-2 px-3">필수</td>
                <td className="py-2 px-3">5-8개 항목 권장</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">✅ 빠른 체크리스트</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Wan2.2 체크리스트 */}
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <h4 className="text-blue-400 font-semibold mb-3">Wan2.2 프롬프트 작성 시</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400">☐</span>
                <span><code className="bg-gray-700 px-1 rounded text-xs">visible pores</code> 또는 <code className="bg-gray-700 px-1 rounded text-xs">detailed skin texture</code> 포함?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">☐</span>
                <span><code className="bg-gray-700 px-1 rounded text-xs">natural imperfections</code> 포함?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">☐</span>
                <span><code className="bg-gray-700 px-1 rounded text-xs">soft diffused lighting</code> 또는 <code className="bg-gray-700 px-1 rounded text-xs">rim lighting</code> 포함?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">☐</span>
                <span><code className="bg-gray-700 px-1 rounded text-xs">85mm lens</code> 또는 렌즈 스펙 포함?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">☐</span>
                <span>네거티브에 <code className="bg-gray-700 px-1 rounded text-xs">plastic skin, airbrushed</code> 포함?</span>
              </li>
            </ul>
          </div>

          {/* LTX2 체크리스트 */}
          <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-4">
            <h4 className="text-purple-400 font-semibold mb-3">LTX2 프롬프트 작성 시</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-purple-400">☐</span>
                <span><code className="bg-gray-700 px-1 rounded text-xs">authentic skin texture</code> 또는 <code className="bg-gray-700 px-1 rounded text-xs">skin texture detailed</code> 포함?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">☐</span>
                <span><code className="bg-gray-700 px-1 rounded text-xs">crisp detail, no mushy surfaces</code> 포함?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">☐</span>
                <span>렌즈 + 조리개 스펙 명시? (예: <code className="bg-gray-700 px-1 rounded text-xs">50mm f/2.8</code>)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">☐</span>
                <span><code className="bg-gray-700 px-1 rounded text-xs">natural sunlight from side</code> 또는 <code className="bg-gray-700 px-1 rounded text-xs">softbox</code> 조명 포함?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">☐</span>
                <span>네거티브에 <code className="bg-gray-700 px-1 rounded text-xs">jitter, plastic skin, high-frequency patterns</code> 포함?</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 참고 자료 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h4 className="text-gray-400 font-semibold mb-2">📚 참고 자료</h4>
        <div className="text-sm text-gray-500 space-y-1">
          <p>• Wan2.2: <a href="https://docs.comfy.org/tutorials/video/wan/wan2_2" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">공식 문서</a>, <a href="https://apatero.com/blog/enhance-skin-details-wan-22-complete-guide-2025" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">Apatero 피부 가이드</a></p>
          <p>• LTX2: <a href="https://docs.ltx.video/api-documentation/prompting-guide" className="text-purple-400 hover:underline" target="_blank" rel="noreferrer">공식 프롬프팅 가이드</a>, <a href="https://stokemctoke.com/the-definitive-ltx-2-video-prompting-guide/" className="text-purple-400 hover:underline" target="_blank" rel="noreferrer">Stoke McToke 시네마틱 가이드</a></p>
        </div>
      </div>
    </div>
  )
}

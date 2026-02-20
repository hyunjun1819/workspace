export function ComfyTab() {
  const comfyUrl = 'http://192.168.0.7:8188'

  return (
    <div className="space-y-6">
      {/* Header with Launch Button */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">ComfyUI 사용법</h2>
            <p className="text-gray-400">
              AI 영상을 만드는 도구입니다. 아래 버튼을 눌러 시작하세요.
            </p>
          </div>
          <a
            href={comfyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            ComfyUI 열기
          </a>
        </div>
      </div>

      {/* 1. Interface Overview */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">1</span>
          화면 구성 이해하기
        </h3>

        {/* Screenshot */}
        <div className="mb-4 rounded-lg overflow-hidden border border-gray-600">
          <img
            src="/guide/overview.png"
            alt="ComfyUI 화면 구성"
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-700/50 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-xs">A</span>
              작업 공간 (가운데)
            </h4>
            <p className="text-gray-300 text-sm">
              네모난 상자들(노드)이 놓여있는 곳입니다. 마우스 휠로 확대/축소, 드래그로 이동할 수 있어요.
            </p>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-green-600 rounded flex items-center justify-center text-xs">B</span>
              실행 버튼 (오른쪽 위)
            </h4>
            <p className="text-gray-300 text-sm">
              <span className="text-green-400 font-semibold">"Queue Prompt"</span> 버튼을 누르면 영상 만들기가 시작됩니다.
            </p>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center text-xs">C</span>
              사이드 패널 (좌측)
            </h4>
            <p className="text-gray-300 text-sm">
              워크플로우를 불러오거나 저장할 수 있어요. 여기서 작업을 시작합니다.
            </p>
          </div>

          <div className="bg-gray-700/50 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
              <span className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center text-xs">D</span>
              진행률 표시 (상단)
            </h4>
            <p className="text-gray-300 text-sm">
              영상이 몇 % 완성됐는지 보여줍니다. 100%가 되면 완성!
            </p>
          </div>
        </div>
      </div>

      {/* 2. Loading Workflow */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">2</span>
          워크플로우 불러오기
        </h3>

        <p className="text-gray-400 text-sm mb-4">
          워크플로우 = 영상을 만드는 레시피. 미리 만들어진 레시피를 불러와서 사용합니다.
        </p>

        {/* Screenshot */}
        <div className="mb-4 rounded-lg overflow-hidden border border-gray-600">
          <img
            src="/guide/workflow.png"
            alt="워크플로우 불러오기"
            className="w-full"
          />
        </div>

        <div className="bg-gray-700/30 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-2">불러오는 방법</h4>
          <ol className="text-gray-300 text-sm space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">1.</span>
              <span>왼쪽 사이드바에서 <span className="text-yellow-400 font-semibold">"Workflow"</span> 버튼을 클릭하세요.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 font-bold">2.</span>
              <span>원하는 워크플로우를 선택하면 자동으로 불러와집니다.</span>
            </li>
          </ol>
        </div>
      </div>

      {/* 3. Parameter Settings */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">3</span>
          기본 설정하기
        </h3>

        {/* Screenshot */}
        <div className="mb-4 rounded-lg overflow-hidden border border-gray-600">
          <img
            src="/guide/params.png"
            alt="파라미터 설정"
            className="w-full"
          />
        </div>

        <div className="space-y-4">
          <div className="bg-gray-700/30 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-2">영상 크기 & 길이</h4>
            <p className="text-gray-300 text-sm">
              영상의 가로/세로 크기와 길이를 조절할 수 있어요.
            </p>
            <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-yellow-300 text-xs">
              주의: 크기나 길이를 늘리면 생성 시간이 오래 걸리고, 너무 크게 설정하면 메모리 부족으로 실패할 수 있어요.
            </div>
          </div>

          <div className="bg-gray-700/30 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-2">프롬프트 (영상 설명)</h4>
            <p className="text-gray-300 text-sm">
              만들고 싶은 영상을 글로 설명하세요. <span className="text-blue-400">영어로 쓰면 더 잘 알아들어요.</span>
            </p>
          </div>
        </div>
      </div>

      {/* 4. LoRA Usage */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">4</span>
          LoRA 사용하기
        </h3>

        <p className="text-gray-400 text-sm mb-4">
          LoRA를 사용하면 카메라 움직임, 스타일 등 특별한 효과를 줄 수 있어요.
        </p>

        {/* Screenshot 1 */}
        <div className="mb-4">
          <p className="text-gray-300 text-sm mb-2">
            <span className="text-purple-400 font-semibold">보라색 노드</span>는 현재 건너뛰기 상태입니다. 이대로 실행하면 LoRA가 적용되지 않아요.
          </p>
          <div className="rounded-lg overflow-hidden border border-gray-600">
            <img
              src="/guide/lora1.png"
              alt="LoRA 비활성 상태"
              className="w-full"
            />
          </div>
        </div>

        {/* Screenshot 2 */}
        <div className="mb-4">
          <p className="text-gray-300 text-sm mb-2">
            LoRA를 사용하려면 노드를 <span className="text-green-400 font-semibold">우클릭</span> → <span className="text-yellow-400">"실행 건너뛰기"</span>를 눌러 활성화하세요.
          </p>
          <div className="rounded-lg overflow-hidden border border-gray-600">
            <img
              src="/guide/lora2.png"
              alt="LoRA 활성화 방법"
              className="w-full"
            />
          </div>
        </div>

        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
          <h4 className="text-red-400 font-semibold mb-2">중요!</h4>
          <ul className="text-gray-300 text-sm space-y-1">
            <li>• 두 개의 LoRA 노드는 <span className="text-red-400 font-semibold">반드시 같은 모델</span>로 설정하세요.</li>
            <li>• 서로 다른 모델을 선택하면 오류가 발생합니다.</li>
          </ul>
        </div>
      </div>

      {/* 5. Run */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">5</span>
          실행하기
        </h3>

        <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4 text-center">
          <p className="text-gray-300 text-lg mb-2">
            모든 설정이 끝나면 오른쪽 위의
          </p>
          <p className="text-green-400 font-bold text-2xl mb-2">
            "Queue Prompt"
          </p>
          <p className="text-gray-300 text-lg">
            버튼을 클릭하세요!
          </p>
          <p className="text-gray-500 text-sm mt-3">
            또는 키보드 <span className="bg-gray-600 px-2 py-1 rounded">Ctrl + Enter</span>
          </p>
        </div>
      </div>

      {/* 6. More Templates */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">+</span>
          더 많은 워크플로우
        </h3>

        <p className="text-gray-400 text-sm mb-4">
          사이드바에서 <span className="text-yellow-400 font-semibold">"Templates"</span>를 클릭하면 다양한 워크플로우를 찾을 수 있어요!
        </p>

        {/* Screenshot */}
        <div className="mb-4 rounded-lg overflow-hidden border border-gray-600">
          <img
            src="/guide/template.png"
            alt="템플릿 목록"
            className="w-full"
          />
        </div>

        <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-4">
          <p className="text-gray-300 text-sm">
            이미지에서 영상 만들기, 다양한 스타일 적용 등 여러 가지 워크플로우가 준비되어 있습니다.
            원하는 것을 골라서 사용해보세요!
          </p>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span>⌨️</span>
          자주 쓰는 키
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: 'Ctrl + Enter', desc: '영상 만들기' },
            { key: 'Ctrl + S', desc: '저장' },
            { key: 'Ctrl + Z', desc: '되돌리기' },
            { key: 'Delete', desc: '노드 삭제' },
          ].map((shortcut) => (
            <div key={shortcut.key} className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-white font-mono text-sm mb-1">{shortcut.key}</div>
              <div className="text-gray-400 text-xs">{shortcut.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

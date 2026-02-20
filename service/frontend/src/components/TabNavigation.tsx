export type TabId = 'guide' | 'lora' | 'comfy' | 'tips' | 'help' | 'settings'

interface Tab {
  id: TabId
  label: string
  icon: string
}

const tabs: Tab[] = [
  { id: 'guide', label: '가이드', icon: '📚' },
  { id: 'lora', label: 'LoRA', icon: '📦' },
  { id: 'comfy', label: 'Comfy', icon: '🖥️' },
  { id: 'tips', label: 'AI프롬프팅', icon: '💡' },
  { id: 'help', label: 'AI채팅', icon: '💬' },
  { id: 'settings', label: '설정', icon: '⚙️' },
]

interface TabNavigationProps {
  activeTab: TabId
  onChange: (tab: TabId) => void
}

export function TabNavigation({ activeTab, onChange }: TabNavigationProps) {
  return (
    <div className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                px-6 py-3 text-sm font-medium transition-colors relative
                ${activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-200'
                }
              `}
            >
              <span className="flex items-center gap-2">
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </span>

              {/* Active indicator */}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

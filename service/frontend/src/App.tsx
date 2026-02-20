import { useState, useEffect } from 'react'
import { TabNavigation, TabId } from './components/TabNavigation'
import { GuideTab } from './components/tabs/GuideTab'
import { LoraTab } from './components/tabs/LoraTab'
import { ComfyTab } from './components/tabs/ComfyTab'
import { TipsTab } from './components/tabs/TipsTab'
import { HelpTab } from './components/tabs/HelpTab'
import { SettingsTab } from './components/tabs/SettingsTab'
import { LoraDetailModal } from './components/LoraDetailModal'
import type { InstalledModel, LoraModel, LoraFilters } from './types'

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('guide')
  const [models, setModels] = useState<InstalledModel[]>([])
  const [loras, setLoras] = useState<LoraModel[]>([])
  const [selectedLora, setSelectedLora] = useState<LoraModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<LoraFilters>({
    base_model: null,
    task_type: null,
    category: null,
    search: '',
    downloaded: null,
  })

  // Fetch installed models
  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models/installed')
      if (!res.ok) {
        console.error(`Failed to fetch models: HTTP ${res.status}`)
        return
      }
      const data = await res.json()
      setModels(data.models || [])
    } catch (error) {
      console.error('Failed to fetch models:', error)
    }
  }

  // Fetch LoRAs with filters
  const fetchLoras = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filters.base_model) params.set('base_model', filters.base_model)
      if (filters.task_type) params.set('task_type', filters.task_type)
      if (filters.category) params.set('category', filters.category)
      if (filters.search) params.set('search', filters.search)
      if (filters.downloaded !== null) params.set('downloaded', String(filters.downloaded))

      const res = await fetch(`/api/loras?${params.toString()}`)
      if (!res.ok) {
        console.error(`Failed to fetch LoRAs: HTTP ${res.status}`)
        return
      }
      const data = await res.json()
      setLoras(data.loras || [])
    } catch (error) {
      console.error('Failed to fetch LoRAs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Initial detection and fetch
  useEffect(() => {
    const initialize = async () => {
      // Detect models first (non-critical, continue even if these fail)
      try {
        await fetch('/api/models/detect', { method: 'GET' })
        await fetch('/api/loras/scan', { method: 'GET' })
      } catch (e) {
        console.error('Failed to initialize: backend may be unreachable', e)
      }

      // Then fetch data
      await fetchModels()
      await fetchLoras()
    }
    initialize().catch(e => console.error('Initialization failed:', e))
  }, [])

  // Refetch when filters change
  useEffect(() => {
    fetchLoras()
  }, [filters])

  const handleFilterChange = (newFilters: Partial<LoraFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const handleRefresh = async () => {
    try {
      await fetch('/api/models/detect', { method: 'GET' })
      await fetch('/api/loras/scan', { method: 'GET' })
    } catch (e) {
      console.error('Failed to refresh: backend may be unreachable', e)
    }
    await fetchModels()
    await fetchLoras()
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">
              Video LoRA Manager
            </h1>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              새로고침
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onChange={setActiveTab} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'guide' && <GuideTab />}

        {activeTab === 'lora' && (
          <LoraTab
            models={models}
            loras={loras}
            loading={loading}
            filters={filters}
            onFilterChange={handleFilterChange}
            onSelectLora={setSelectedLora}
            onDownloadComplete={handleRefresh}
          />
        )}

        {activeTab === 'comfy' && <ComfyTab />}

        {activeTab === 'tips' && <TipsTab />}

        {activeTab === 'help' && <HelpTab />}

        {activeTab === 'settings' && (
          <SettingsTab
            models={models}
            onRefresh={handleRefresh}
          />
        )}
      </main>

      {/* Detail Modal */}
      {selectedLora && (
        <LoraDetailModal
          lora={selectedLora}
          onClose={() => setSelectedLora(null)}
          onDownloadComplete={handleRefresh}
        />
      )}
    </div>
  )
}

export default App

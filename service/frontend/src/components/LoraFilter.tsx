import type { InstalledModel, LoraFilters, TaskType } from '../types'

interface LoraFilterProps {
  models: InstalledModel[]
  filters: LoraFilters
  onFilterChange: (filters: Partial<LoraFilters>) => void
}

export function LoraFilter({ models, filters, onFilterChange }: LoraFilterProps) {
  // Get available categories based on selected model and task
  const getAvailableCategories = (): string[] => {
    if (!filters.base_model) return []

    const model = models.find(m => m.name === filters.base_model)
    if (!model) return []

    if (filters.task_type === 'T2V') {
      return model.t2v_categories || []
    } else if (filters.task_type === 'I2V') {
      return model.i2v_categories || []
    } else {
      // Return all categories
      return [
        ...(model.t2v_categories || []),
        ...(model.i2v_categories || [])
      ].filter((v, i, a) => a.indexOf(v) === i)
    }
  }

  const categories = getAvailableCategories()

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
      <div className="flex gap-4 flex-wrap items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm text-gray-400 mb-2">검색</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="LoRA 이름으로 검색..."
            className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Base Model Filter */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">베이스 모델</label>
          <select
            value={filters.base_model || ''}
            onChange={(e) => {
              onFilterChange({
                base_model: e.target.value || null,
                category: null  // Reset category when model changes
              })
            }}
            className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none min-w-[150px]"
          >
            <option value="">전체</option>
            {models.map((model) => (
              <option key={model.name} value={model.name}>
                {model.display_name}
              </option>
            ))}
          </select>
        </div>

        {/* Task Type Filter */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">태스크</label>
          <select
            value={filters.task_type || ''}
            onChange={(e) => {
              onFilterChange({
                task_type: (e.target.value as TaskType) || null,
                category: null  // Reset category when task changes
              })
            }}
            className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none min-w-[140px]"
            disabled={!filters.base_model}
          >
            <option value="">전체</option>
            {filters.base_model && (
              <>
                {models.find(m => m.name === filters.base_model)?.supports_t2v && (
                  <option value="T2V">Text-to-Video</option>
                )}
                {models.find(m => m.name === filters.base_model)?.supports_i2v && (
                  <option value="I2V">Image-to-Video</option>
                )}
              </>
            )}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">카테고리</label>
          <select
            value={filters.category || ''}
            onChange={(e) => onFilterChange({ category: e.target.value || null })}
            className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none min-w-[130px]"
            disabled={!filters.base_model || categories.length === 0}
          >
            <option value="">전체</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Downloaded Filter */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">상태</label>
          <select
            value={filters.downloaded === null ? '' : String(filters.downloaded)}
            onChange={(e) => {
              const val = e.target.value
              onFilterChange({
                downloaded: val === '' ? null : val === 'true'
              })
            }}
            className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none min-w-[120px]"
          >
            <option value="">전체</option>
            <option value="true">설치됨</option>
            <option value="false">미설치</option>
          </select>
        </div>

        {/* Clear Filters */}
        <button
          onClick={() => onFilterChange({
            base_model: null,
            task_type: null,
            category: null,
            search: '',
            downloaded: null
          })}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
        >
          초기화
        </button>
      </div>
    </div>
  )
}

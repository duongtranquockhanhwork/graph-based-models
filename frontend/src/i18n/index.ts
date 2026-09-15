export type Language = 'en' | 'vi'

export type Dict = Record<string, unknown>

// Mỗi file trong locales/en|vi/*.ts export default một object phẳng hoặc
// lồng nhau, tên file = namespace (vd. locales/en/sidebar.ts -> "sidebar").
// Dùng import.meta.glob để tự động gom hết namespace lại — thêm file mới
// không cần sửa file này, tránh xung đột khi nhiều người/agent cùng thêm
// bản dịch song song.
const enModules = import.meta.glob<{ default: Dict }>('./locales/en/*.ts', { eager: true })
const viModules = import.meta.glob<{ default: Dict }>('./locales/vi/*.ts', { eager: true })

function buildDictionary(modules: Record<string, { default: Dict }>): Dict {
  const dict: Dict = {}
  for (const path in modules) {
    const match = path.match(/([^/]+)\.ts$/)
    const namespace = match ? match[1] : path
    dict[namespace] = modules[path].default
  }
  return dict
}

const dictionaries: Record<Language, Dict> = {
  en: buildDictionary(enModules),
  vi: buildDictionary(viModules),
}

function lookup(dict: Dict, key: string): unknown {
  let value: unknown = dict
  for (const part of key.split('.')) {
    if (value == null || typeof value !== 'object') return undefined
    value = (value as Dict)[part]
  }
  return value
}

/** key dạng "namespace.sub.key". Thiếu ở ngôn ngữ hiện tại -> rơi về tiếng
 * Anh -> rơi về chính key (dễ nhận ra chỗ còn thiếu bản dịch khi test). */
export function translate(language: Language, key: string, params?: Record<string, string | number>): string {
  let value = lookup(dictionaries[language], key)
  if (typeof value !== 'string' && language !== 'en') {
    value = lookup(dictionaries.en, key)
  }
  if (typeof value !== 'string') return key
  if (!params) return value
  return Object.entries(params).reduce((acc, [k, v]) => acc.split(`{{${k}}}`).join(String(v)), value)
}

import { useLanguage } from '../context/LanguageContext'

const OPTIONS: { code: 'en' | 'vi'; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Tiếng Việt' },
]

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div
      className="inline-flex items-center rounded-full p-0.5 flex-shrink-0"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      role="group"
      aria-label="Language"
    >
      {OPTIONS.map((opt) => {
        const active = language === opt.code
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLanguage(opt.code)}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors"
            style={{
              background: active ? 'var(--accent-blue)' : 'transparent',
              color: active ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

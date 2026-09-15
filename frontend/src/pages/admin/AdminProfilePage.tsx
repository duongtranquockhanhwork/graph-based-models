import { Link } from 'react-router-dom'
import { Globe, KeyRound, Mail, Palette, Phone, User as UserIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import ThemeToggle from '../../components/ThemeToggle'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import ProfileEditForm from '../../components/Settings/ProfileEditForm'
import ChangePasswordForm from '../../components/Settings/ChangePasswordForm'

export default function AdminProfilePage() {
  const { user } = useAuth()
  const { theme } = useTheme()
  const { t, language } = useLanguage()

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5 fade-in">
      <div>
        <h2 className="font-sans text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('adminProfile.title')}</h2>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {t('adminProfile.subtitle')}
        </p>
      </div>

      <div className="section-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <UserIcon size={15} /> {t('adminProfile.accountSection')}
          </h3>
          <span
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            {t('adminProfile.roleAdmin')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mb-4" style={{ color: 'var(--text-muted)' }}>
          {user?.email ? <Mail size={12} /> : <Phone size={12} />}
          <span className="text-[12px]">{user?.email || user?.phone}</span>
        </div>
        <ProfileEditForm />
      </div>

      <div className="section-card">
        <h3 className="text-[13px] font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Palette size={15} /> {t('adminProfile.appearanceSection')}
        </h3>
        <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>
          {t('adminProfile.appearanceDesc')}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {theme === 'dark' ? t('adminProfile.themeDark') : t('adminProfile.themeLight')}
          </span>
          <ThemeToggle />
        </div>
      </div>

      <div className="section-card">
        <h3 className="text-[13px] font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Globe size={15} /> {t('adminProfile.languageSection')}
        </h3>
        <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>
          {t('adminProfile.languageDesc')}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            {language === 'vi' ? t('adminProfile.languageViLabel') : t('adminProfile.languageEnLabel')}
          </span>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="section-card">
        <h3 className="text-[13px] font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <KeyRound size={15} /> {t('adminProfile.securitySection')}
        </h3>
        <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
          {t('adminProfile.securityDesc')}
        </p>
        <ChangePasswordForm />
        <Link
          to="/forgot-password"
          className="inline-block mt-3 text-[12px] underline"
          style={{ color: 'var(--text-muted)' }}
        >
          {t('adminProfile.forgotPassword')}
        </Link>
      </div>
    </div>
  )
}

import { GoogleLogin } from '@react-oauth/google'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import type { User } from '../../types'

interface GoogleAuthButtonProps {
  onSuccess?: (user: User) => void
}

export default function GoogleAuthButton({ onSuccess }: GoogleAuthButtonProps) {
  const { loginWithGoogle } = useAuth()

  return (
    <div>
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
        <span className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
          hoặc
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
      </div>

      <div className="flex justify-center">
        <GoogleLogin
          theme="filled_black"
          shape="pill"
          width="336"
          onSuccess={async (credentialResponse) => {
            if (!credentialResponse.credential) {
              toast.error('Đăng nhập Google thất bại')
              return
            }
            try {
              const user = await loginWithGoogle(credentialResponse.credential)
              toast.success('Đăng nhập thành công')
              onSuccess?.(user)
            } catch {
              toast.error('Đăng nhập Google thất bại')
            }
          }}
          onError={() => toast.error('Đăng nhập Google thất bại')}
        />
      </div>
    </div>
  )
}

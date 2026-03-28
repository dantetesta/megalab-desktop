import { useAppStore } from '../stores/appStore'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

export default function Toast() {
  const { toast, clearToast } = useAppStore()
  if (!toast) return null

  const config = {
    success: {
      icon: <CheckCircle size={20} />,
      bg: 'linear-gradient(135deg, #0d7a4d, #169958)',
      color: '#ffffff',
      border: 'none',
    },
    error: {
      icon: <XCircle size={20} />,
      bg: 'linear-gradient(135deg, #c62828, #e53935)',
      color: '#ffffff',
      border: 'none',
    },
    info: {
      icon: <Info size={20} />,
      bg: 'linear-gradient(135deg, #1565c0, #1e88e5)',
      color: '#ffffff',
      border: 'none',
    },
  }

  const c = config[toast.type]

  return (
    <div className="animate-slide-up"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        borderRadius: 14, padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        minWidth: 320, maxWidth: 480,
        background: c.bg, color: c.color,
        border: c.border,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15)',
        fontFamily: 'inherit',
      }}>
      <div style={{ flexShrink: 0, display: 'flex' }}>{c.icon}</div>
      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
      <button onClick={clearToast} style={{
        background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: '#fff', flexShrink: 0, transition: 'background 0.15s',
      }}><X size={14} /></button>
    </div>
  )
}

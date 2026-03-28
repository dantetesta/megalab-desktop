import { useAppStore } from '@/stores/appStore'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Toast() {
  const { toast, clearToast } = useAppStore()
  if (!toast) return null

  const config = {
    success: {
      icon: <CheckCircle size={20} />,
      classes: 'bg-gradient-to-br from-emerald-700 to-emerald-500',
    },
    error: {
      icon: <XCircle size={20} />,
      classes: 'bg-gradient-to-br from-red-800 to-red-500',
    },
    info: {
      icon: <Info size={20} />,
      classes: 'bg-gradient-to-br from-blue-800 to-blue-500',
    },
  }

  const c = config[toast.type]

  return (
    <div
      className={cn(
        'animate-slide-up fixed bottom-6 right-6 z-[9999]',
        'rounded-xl px-5 py-3.5 flex items-center gap-3',
        'min-w-[320px] max-w-[480px] text-white',
        'shadow-[0_8px_32px_rgba(0,0,0,0.3),0_2px_8px_rgba(0,0,0,0.15)]',
        c.classes,
      )}
    >
      <div className="shrink-0 flex">{c.icon}</div>
      <span className="text-[13px] font-semibold flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={clearToast}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors cursor-pointer border-none text-white"
      >
        <X size={14} />
      </button>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { api, type CreditsData } from '../lib/tauri'
import { useAppStore } from '../stores/appStore'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { Copy, Globe, ExternalLink, GraduationCap, Loader2, CheckCircle } from 'lucide-react'

export default function Creditos() {
  const { showToast } = useAppStore()
  const [credits, setCredits] = useState<CreditsData | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getCreditsData()
      .then(setCredits)
      .catch((e: any) => {
        console.error('Erro ao carregar créditos:', e)
        setError('Erro ao carregar página de créditos')
        showToast('Erro ao carregar créditos', 'error')
      })
  }, [])

  const handleCopyPix = async () => {
    if (!credits) return
    try { await writeText(credits.pix_key); showToast('Chave Pix copiada!', 'success'); setCopied(true); setTimeout(() => setCopied(false), 2500) }
    catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
  }

  if (error) return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}><p style={{ fontSize: 16, color: 'var(--ml-error)' }}>❌ {error}</p><button onClick={() => window.location.reload()} style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--ml-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>Tentar novamente</button></div>

  if (!credits) return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={32} className="animate-spin" style={{ color: 'var(--ml-primary)' }} /></div>

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '32px 40px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Cover image */}
        <div style={{ borderRadius: 20, overflow: 'hidden', marginBottom: 24 }}>
          <img src="/author.png" alt="Dante Testa - LotoLab" style={{ width: '100%', display: 'block' }} />
        </div>

        {/* 2-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* Left: Message */}
          <div style={{ background: 'var(--ml-surface-low)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ml-on-surface)', marginBottom: 12 }}>{credits.message_headline}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ml-on-surface-variant)', margin: 0 }}>{credits.message_body}</p>
          </div>

          {/* Right: Pix */}
          <div style={{ background: 'var(--ml-surface-low)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ml-on-surface-variant)', textAlign: 'center' }}>{credits.pix_note}</p>
            <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: '14px 20px', width: '100%', textAlign: 'center' }}>
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--ml-on-surface-variant)', marginBottom: 6 }}>Chave Pix</p>
              <p style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: 'var(--ml-primary)', wordBreak: 'break-all' }}>{credits.pix_key}</p>
            </div>
            <button onClick={handleCopyPix} className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 14, padding: '12px 20px' }}>
              {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado!' : 'Copiar Chave Pix'}
            </button>
          </div>
        </div>

        {/* Links - 2 columns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          <a href={credits.website} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 12, background: 'var(--ml-surface-low)', borderRadius: 14, padding: '16px 20px', textDecoration: 'none', transition: 'all 0.15s',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'color-mix(in srgb, var(--ml-primary) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Globe size={18} style={{ color: 'var(--ml-primary)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ml-on-surface)' }}>Site Oficial</div>
              <div style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', marginTop: 2 }}>{credits.website.replace(/^https?:\/\//, '')}</div>
            </div>
            <ExternalLink size={14} style={{ color: 'var(--ml-on-surface-variant)', opacity: 0.4 }} />
          </a>
          <a href={credits.academy_website} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', gap: 12, background: 'var(--ml-surface-low)', borderRadius: 14, padding: '16px 20px', textDecoration: 'none', transition: 'all 0.15s',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'color-mix(in srgb, var(--ml-info) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <GraduationCap size={18} style={{ color: 'var(--ml-info)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ml-on-surface)' }}>Academy</div>
              <div style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', marginTop: 2 }}>{credits.academy_website.replace(/^https?:\/\//, '')}</div>
            </div>
            <ExternalLink size={14} style={{ color: 'var(--ml-on-surface-variant)', opacity: 0.4 }} />
          </a>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <p style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', opacity: 0.4 }}>{credits.api_credit}</p>
          <p style={{ fontSize: 10, color: 'var(--ml-on-surface-variant)', opacity: 0.3, marginTop: 4 }}>LotoLab v{credits.app_version}</p>
        </div>
      </div>
    </div>
  )
}

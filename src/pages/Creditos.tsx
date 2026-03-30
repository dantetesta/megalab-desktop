import { useState, useEffect } from 'react'
import { api, type CreditsData } from '@/lib/tauri'
import { useAppStore } from '@/stores/appStore'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { Copy, Globe, ExternalLink, GraduationCap, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Creditos() {
  const { showToast } = useAppStore()
  const [credits, setCredits] = useState<CreditsData | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getCreditsData()
      .then(setCredits)
      .catch((e: any) => {
        console.error('Erro ao carregar creditos:', e)
        setError('Erro ao carregar pagina de creditos')
        showToast('Erro ao carregar creditos', 'error')
      })
  }, [])

  const handleCopyPix = async () => {
    if (!credits) return
    try { await writeText(credits.pix_key); showToast('Chave Pix copiada!', 'success'); setCopied(true); setTimeout(() => setCopied(false), 2500) }
    catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
  }

  if (error) return (
    <div className="h-full flex items-center justify-center flex-col gap-4">
      <p className="text-base text-destructive">{error}</p>
      <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
    </div>
  )

  if (!credits) return <div className="h-full flex items-center justify-center"><Loader2 size={32} className="animate-spin text-primary" /></div>

  return (
    <div>
      <div className="max-w-[720px] mx-auto">
        {/* Cover image */}
        <div className="rounded-xl overflow-hidden mb-6">
          <img src="/author.png" alt="Dante Testa - LotoLab" className="w-full block" />
        </div>

        {/* 2-column layout */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Left: Message */}
          <Card className="flex flex-col justify-center">
            <CardContent className="p-6">
              <h2 className="text-xl font-extrabold text-foreground mb-3">{credits.message_headline}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{credits.message_body}</p>
            </CardContent>
          </Card>

          {/* Right: Pix */}
          <Card className="flex flex-col items-center justify-center">
            <CardContent className="p-6 flex flex-col items-center gap-3.5 w-full">
              <p className="text-xs font-semibold text-muted-foreground text-center">{credits.pix_note}</p>
              <div className="bg-muted rounded-xl px-5 py-3.5 w-full text-center">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">Chave Pix</p>
                <p className="text-base font-extrabold font-mono text-primary break-all">{credits.pix_key}</p>
              </div>
              <Button onClick={handleCopyPix} className="w-full justify-center gap-2">
                {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar Chave Pix'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Links */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <a href={credits.website} target="_blank" rel="noopener noreferrer" className="no-underline">
            <Card className="hover:bg-accent transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-primary/12 flex items-center justify-center shrink-0">
                  <Globe size={18} className="text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground">Site Oficial</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{credits.website.replace(/^https?:\/\//, '')}</div>
                </div>
                <ExternalLink size={14} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </a>
          <a href={credits.academy_website} target="_blank" rel="noopener noreferrer" className="no-underline">
            <Card className="hover:bg-accent transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-blue-500/12 flex items-center justify-center shrink-0">
                  <GraduationCap size={18} className="text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-foreground">Academy</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{credits.academy_website.replace(/^https?:\/\//, '')}</div>
                </div>
                <ExternalLink size={14} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </a>
        </div>

        {/* Footer */}
        <div className="text-center py-2">
          <p className="text-[11px] text-muted-foreground">{credits.api_credit}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">LotoLab v{credits.app_version}</p>
        </div>
      </div>
    </div>
  )
}

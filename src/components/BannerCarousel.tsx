import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { api, type LocalBanner, assetUrl } from '@/lib/tauri'

interface BannerCarouselProps {
  position: 'sidebar' | 'dashboard' | 'internal'
  className?: string
}

const POSITION_MAP: Record<string, string[]> = {
  sidebar: ['sidebar', 'menu'],
  dashboard: ['dashboard', 'home'],
  internal: ['internal', 'internas', 'interna'],
}

export default function BannerCarousel({ position, className = '' }: BannerCarouselProps) {
  const [banners, setBanners] = useState<LocalBanner[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const validPositions = POSITION_MAP[position] || [position]
    // First try local cache, then sync if empty
    api.getBanners().then(all => {
      const filtered = all.filter(b => validPositions.includes(b.position) && b.local_image_path)
      if (filtered.length > 0) {
        setBanners(filtered)
      } else {
        // Try syncing from server
        api.syncBanners().then(synced => {
          setBanners(synced.filter(b => validPositions.includes(b.position) && b.local_image_path))
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [position])

  useEffect(() => {
    if (banners.length <= 1) return
    const current = banners[currentIndex]
    const duration = (current?.duration_seconds || 5) * 1000
    const timer = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % banners.length)
    }, duration)
    return () => clearTimeout(timer)
  }, [currentIndex, banners])

  if (banners.length === 0) return null
  const current = banners[currentIndex]
  if (!current) return null

  const imgSrc = assetUrl(current.local_image_path)
  const aspectClass = position === 'internal' ? 'aspect-[6/1]' : 'aspect-square'

  return (
    <div
      className={`relative overflow-hidden rounded-lg cursor-pointer group ${className}`}
      onClick={() => current.link_url && invoke('open_url', { url: current.link_url }).catch(() => window.open(current.link_url, '_blank'))}
    >
      <div className={`w-full ${aspectClass} relative overflow-hidden bg-card`}>
        <img
          src={imgSrc}
          alt={current.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>

      {banners.length > 1 && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i) }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === currentIndex ? 'bg-white w-3' : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      )}

      <span className="absolute top-1 right-1.5 text-[8px] text-white/50 font-medium">
        patrocinado
      </span>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { api, type LocalBanner, assetUrl } from '@/lib/tauri'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
    api.getBanners().then(all => {
      const filtered = all.filter(b => validPositions.includes(b.position) && b.local_image_path)
      if (filtered.length > 0) {
        setBanners(filtered)
      } else {
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
      className={`relative rounded-lg cursor-pointer group ${className}`}
      onClick={() => current.link_url && invoke('open_url', { url: current.link_url }).catch(() => window.open(current.link_url, '_blank'))}
    >
      {/* Banner image */}
      <div className={`w-full ${aspectClass} relative overflow-hidden rounded-lg bg-card`}>
        <img
          src={imgSrc}
          alt={current.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>

      {/* Prev / Next arrows — top-right, appear on hover only */}
      {banners.length > 1 && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i - 1 + banners.length) % banners.length) }}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-black/50 text-white hover:bg-black/75 transition-colors backdrop-blur-sm"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setCurrentIndex(i => (i + 1) % banners.length) }}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-black/50 text-white hover:bg-black/75 transition-colors backdrop-blur-sm"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* Dot indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-10 flex gap-1">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrentIndex(i) }}
              className={`h-1.5 rounded-full transition-all ${
                i === currentIndex ? 'bg-white w-3' : 'bg-white/40 w-1.5'
              }`}
            />
          ))}
        </div>
      )}

      <span className="absolute top-1 left-1.5 z-10 text-[9px] text-white/50 font-medium select-none">
        patrocinado
      </span>
    </div>
  )
}

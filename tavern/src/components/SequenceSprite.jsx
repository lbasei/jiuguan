import { useEffect, useMemo, useState } from 'react'
import {
  buildHeshuiCatalog,
  getHeshuiFrames,
  hasHeshuiFrames as catalogHasFrames,
  shouldPlayHeshui as shouldPlayFromCatalog,
} from '../engine/heshuiFrames.js'

const HESHUI_MODULES = import.meta.glob('../../animation/heshui/*/*.png', {
  eager: true,
  import: 'default',
})

const HESHUI_CATALOG = buildHeshuiCatalog(HESHUI_MODULES)

export function hasHeshuiFrames(characterId) {
  return catalogHasFrames(HESHUI_CATALOG, characterId)
}

export function shouldPlayHeshui(taskType, characterId) {
  return shouldPlayFromCatalog(taskType, characterId, HESHUI_CATALOG)
}

/**
 * Loop a character sequence. Falls back to a static image when frames are missing.
 */
export default function SequenceSprite({
  characterId,
  fps = 10,
  className = '',
  alt = '',
  fallbackSrc = '',
  loop = true,
}) {
  const frames = useMemo(() => getHeshuiFrames(HESHUI_CATALOG, characterId), [characterId])
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    setFrameIndex(0)
  }, [characterId, frames.length])

  useEffect(() => {
    if (frames.length <= 1) return undefined
    const intervalMs = Math.max(16, Math.round(1000 / Math.max(1, fps)))
    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        const next = current + 1
        if (next < frames.length) return next
        return loop ? 0 : current
      })
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [frames, fps, loop])

  const src = frames[frameIndex] || fallbackSrc
  if (!src) return null

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      draggable={false}
      decoding="async"
    />
  )
}

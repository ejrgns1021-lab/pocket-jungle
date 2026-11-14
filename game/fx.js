// 이펙트 도구 모음 — 빛나는 원(글로우) 텍스처를 색·크기별로 미리 구워 두고 재사용한다.
// (shadowBlur 같은 무거운 기능 대신 미리 구운 이미지를 'lighter' 합성으로 겹쳐 그려서 모바일에서도 빠름)

const glowCache = new Map()

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 색·반지름별 부드러운 빛 원 (반지름은 4px 단위로 묶어 캐시 수를 줄임) */
export function getGlow(color, radius) {
  const r = Math.max(4, Math.ceil(radius / 4) * 4)
  const key = color + '|' + r
  let c = glowCache.get(key)
  if (c) return c
  if (glowCache.size > 260) glowCache.clear()
  c = document.createElement('canvas')
  c.width = c.height = r * 2
  const g = c.getContext('2d')
  const [R, G, B] = hexToRgb(color)
  const grad = g.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, `rgba(${R},${G},${B},0.9)`)
  grad.addColorStop(0.25, `rgba(${R},${G},${B},0.45)`)
  grad.addColorStop(0.6, `rgba(${R},${G},${B},0.12)`)
  grad.addColorStop(1, `rgba(${R},${G},${B},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, r * 2, r * 2)
  glowCache.set(key, c)
  return c
}

export function drawGlow(ctx, color, x, y, radius, alpha = 1) {
  const img = getGlow(color, radius)
  if (alpha !== 1) ctx.globalAlpha = alpha
  ctx.drawImage(img, x - img.width / 2, y - img.height / 2)
  if (alpha !== 1) ctx.globalAlpha = 1
}

/** 번개 모양 지그재그 점들 */
export function jaggedPoints(x1, y1, x2, y2, segs, amp) {
  const pts = [[x1, y1]]
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    const off = (Math.random() - 0.5) * amp * 2 * Math.sin(t * Math.PI)
    pts.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off])
  }
  pts.push([x2, y2])
  return pts
}

export function strokePts(ctx, pts) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.stroke()
}

export const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2)
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

export const RAINBOW = ['#ff5858', '#ffb838', '#f8f858', '#58f878', '#58c8ff', '#9878ff', '#f858d8']

// Draws a note onto a sheet of lined paper and returns it as an image URL,
// so PaperCrumple (which crumples images) can crumple text.
export const PAPER_W = 320
export const PAPER_H = 400
const SCALE = 2 // render at 2x so text stays sharp on the 3D sheet

function wrap(ctx, text, maxWidth) {
  const lines = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width <= maxWidth || !line) line = next
      else { lines.push(line); line = word }
    }
    lines.push(line)
  }
  return lines
}

export async function notePaperURL(text, date) {
  const font = '500 34px "Inter Tight"'
  try { await document.fonts.load(font) } catch { /* fall back to system font */ }
  const c = document.createElement('canvas')
  c.width = PAPER_W * SCALE
  c.height = PAPER_H * SCALE
  const ctx = c.getContext('2d')
  const W = c.width, H = c.height, LINE = 52, TOP = 120, LEFT = 84

  ctx.fillStyle = '#FFFCE5' // butter paper
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#E6DFA0'
  ctx.lineWidth = 2
  for (let y = TOP; y < H - 60; y += LINE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  ctx.strokeStyle = '#D76574' // margin rule
  ctx.beginPath(); ctx.moveTo(LEFT - 20, 0); ctx.lineTo(LEFT - 20, H); ctx.stroke()

  ctx.fillStyle = '#0A0A0A'
  ctx.font = font
  ctx.textBaseline = 'alphabetic'
  const maxLines = Math.floor((H - 60 - TOP) / LINE) + 1
  let lines = wrap(ctx, text, W - LEFT - 40)
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + ' …'
  }
  lines.forEach((l, i) => ctx.fillText(l, LEFT, TOP - 12 + i * LINE))

  ctx.fillStyle = '#555'
  ctx.font = '500 22px "Inter Tight", system-ui, sans-serif'
  ctx.fillText(date, LEFT, H - 28)
  return c.toDataURL('image/png')
}

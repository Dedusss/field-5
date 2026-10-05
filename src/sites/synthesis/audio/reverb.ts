/**
 * Синтетический импульс реверберации: стерео-буфер 1.9 c,
 * шум * exp(-3t) с лёгкой предзадержкой 20 мс.
 */
export function createReverbIR(ctx: AudioContext): AudioBuffer {
  const seconds = 1.9
  const length = Math.floor(ctx.sampleRate * seconds)
  const preDelay = Math.floor(ctx.sampleRate * 0.02)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = preDelay; i < length; i++) {
      const t = (i - preDelay) / ctx.sampleRate
      // мягкая атака 4 мс, чтобы предзадержка не щёлкала
      const fade = Math.min(1, t / 0.004)
      data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * t) * fade
    }
  }
  return buffer
}

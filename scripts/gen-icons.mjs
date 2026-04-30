import { writeFileSync } from 'fs'
import { deflateSync } from 'zlib'

const crc32table = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = -1
  for (const b of buf) crc = (crc >>> 8) ^ crc32table[(crc ^ b) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type)
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcBuf = Buffer.concat([typeBytes, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcBuf))
  return Buffer.concat([len, typeBytes, data, crc])
}

function createPNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // RGBA

  const cx = size / 2, cy = size / 2
  const r = size * 0.35
  const lineW = size * 0.11

  const scanlines = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4)
    scanlines[row] = 0
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4
      const dx = x - cx, dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const onCircle = Math.abs(dist - r) < size * 0.055
      const onLine = Math.abs(dx) < lineW / 2 && dist < r + size * 0.055
      if (onCircle || onLine) {
        scanlines[i] = 255; scanlines[i+1] = 255; scanlines[i+2] = 255; scanlines[i+3] = 255
      } else {
        // brick #b54f2e
        scanlines[i] = 181; scanlines[i+1] = 79; scanlines[i+2] = 46; scanlines[i+3] = 255
      }
    }
  }

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))])
}

writeFileSync('public/icon-192.png', createPNG(192))
writeFileSync('public/icon-512.png', createPNG(512))
console.log('icon-192.png y icon-512.png generados en public/')

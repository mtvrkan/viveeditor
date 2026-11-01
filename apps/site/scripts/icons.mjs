import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const out = (name) => new URL(`../public/${name}`, import.meta.url)
const png = (size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

for (const size of [192, 256, 512]) writeFileSync(out(`icon-${size}.png`), png(size))
writeFileSync(out('favicon-32.png'), png(32))

const images = [16, 32, 48].map((size) => ({ size, data: png(size) }))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(images.length, 4)
let offset = 6 + 16 * images.length
const entries = images.map(({ size, data }) => {
  const entry = Buffer.alloc(16)
  entry.writeUInt8(size, 0)
  entry.writeUInt8(size, 1)
  entry.writeUInt16LE(1, 4)
  entry.writeUInt16LE(32, 6)
  entry.writeUInt32LE(data.length, 8)
  entry.writeUInt32LE(offset, 12)
  offset += data.length
  return entry
})
writeFileSync(out('favicon.ico'), Buffer.concat([header, ...entries, ...images.map((i) => i.data)]))

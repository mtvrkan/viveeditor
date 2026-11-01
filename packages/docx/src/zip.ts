import { Inflate } from 'fflate'
import { DocxError } from './errors.js'

export interface ZipLimits {
  totalBytes: number
  partBytes: (name: string) => number
}

const CENTRAL_SIGNATURE = 0x02014b50
const END_SIGNATURE = 0x06054b50
const LOCAL_SIGNATURE = 0x04034b50
const CHUNK = 4096

interface Entry {
  name: string
  method: number
  compressedSize: number
  localOffset: number
}

function findEnd(view: DataView): number {
  const lowest = Math.max(0, view.byteLength - 22 - 65_535)
  for (let offset = view.byteLength - 22; offset >= lowest; offset--) {
    if (view.getUint32(offset, true) === END_SIGNATURE) return offset
  }
  throw new DocxError('NOT_DOCX', 'The file is not a Word document.')
}

function readEntries(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = findEnd(view)
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const entries: Entry[] = []
  for (let index = 0; index < count; index++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new DocxError('DAMAGED', 'The Word document is damaged.')
    }
    const flags = view.getUint16(offset + 8, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    if (flags & 1) throw new DocxError('ENCRYPTED', 'The Word document is password protected.')
    if (offset + 46 + nameLength > bytes.length) {
      throw new DocxError('DAMAGED', 'The Word document is damaged.')
    }
    let name: string
    try {
      name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    } catch {
      throw new DocxError('DAMAGED', 'The Word document is damaged.')
    }
    entries.push({
      name,
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localOffset: view.getUint32(offset + 42, true),
    })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

function dataStart(bytes: Uint8Array, entry: Entry): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const offset = entry.localOffset
  if (offset + 30 > bytes.length || view.getUint32(offset, true) !== LOCAL_SIGNATURE) {
    throw new DocxError('DAMAGED', 'The Word document is damaged.')
  }
  const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true)
  if (start + entry.compressedSize > bytes.length) {
    throw new DocxError('DAMAGED', 'The Word document is damaged.')
  }
  return start
}

function inflateLimited(
  data: Uint8Array,
  limit: number,
  onBytes: (size: number) => void,
): Uint8Array {
  const chunks: Uint8Array[] = []
  let size = 0
  let finished = false
  const inflate = new Inflate((chunk, final) => {
    size += chunk.length
    onBytes(chunk.length)
    if (size > limit) throw new DocxError('TOO_LARGE', 'A part of the Word document is too large.')
    chunks.push(chunk)
    if (final) finished = true
  })
  try {
    for (let offset = 0; offset < data.length; offset += CHUNK) {
      const end = Math.min(offset + CHUNK, data.length)
      inflate.push(data.subarray(offset, end), end === data.length)
    }
  } catch (error) {
    if (error instanceof DocxError) throw error
    throw new DocxError('DAMAGED', 'The Word document is damaged.')
  }
  if (!finished && data.length > 0) throw new DocxError('DAMAGED', 'The Word document is damaged.')
  const output = new Uint8Array(size)
  let position = 0
  for (const chunk of chunks) {
    output.set(chunk, position)
    position += chunk.length
  }
  return output
}

export function readZip(
  bytes: Uint8Array,
  wanted: (name: string) => boolean,
  limits: ZipLimits,
): Map<string, Uint8Array> {
  const entries = readEntries(bytes)
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.name)) throw new DocxError('DAMAGED', 'The Word document is damaged.')
    seen.add(entry.name)
  }
  const parts = new Map<string, Uint8Array>()
  let total = 0
  const count = (size: number): void => {
    total += size
    if (total > limits.totalBytes) {
      throw new DocxError('TOO_LARGE', 'The Word document expands to too much data.')
    }
  }
  for (const entry of entries) {
    if (!wanted(entry.name)) continue
    if (entry.method !== 0 && entry.method !== 8) {
      throw new DocxError('UNSUPPORTED', 'The Word document uses an unsupported compression.')
    }
    const start = dataStart(bytes, entry)
    const data = bytes.subarray(start, start + entry.compressedSize)
    const limit = limits.partBytes(entry.name)
    if (entry.method === 0) {
      if (data.length > limit)
        throw new DocxError('TOO_LARGE', 'A part of the Word document is too large.')
      count(data.length)
      parts.set(entry.name, data.slice())
    } else {
      parts.set(entry.name, inflateLimited(data, limit, count))
    }
  }
  return parts
}

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORDS = [
  'editör',
  'metin',
  'yazı',
  'başlık',
  'paragraf',
  'liste',
  'tablo',
  'görsel',
  'bağlantı',
  'sürüm',
  'kurulum',
  'yapıştırma',
  'Türkçe',
  'karakter',
  'İstanbul',
  'ırmak',
  'öğrenci',
  'şehir',
  'çalışma',
  'güncelleme',
  'belge',
  'okuyucu',
  'klavye',
  'kısayol',
  'biçim',
  'renk',
  'hizalama',
  'temizlik',
  'güvenlik',
  'hız',
]

function random(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function sentence(next, words) {
  const picked = Array.from({ length: words }, () => WORDS[Math.floor(next() * WORDS.length)])
  const text = picked.join(' ')
  return `${text.charAt(0).toLocaleUpperCase('tr')}${text.slice(1)}.`
}

function inline(next) {
  const parts = [sentence(next, 8)]
  const roll = next()
  if (roll < 0.2) parts.push(`<strong>${sentence(next, 3)}</strong>`)
  else if (roll < 0.35) parts.push(`<em>${sentence(next, 3)}</em>`)
  else if (roll < 0.45)
    parts.push(`<a href="https://viveeditor.dev/belge">${sentence(next, 2)}</a>`)
  parts.push(sentence(next, 12))
  return parts.join(' ')
}

export function articleHtml({ paragraphs = 5000, seed = 1 } = {}) {
  const next = random(seed)
  const blocks = []
  for (let index = 0; index < paragraphs; index++) {
    if (index % 50 === 0) blocks.push(`<h2>${sentence(next, 4)}</h2>`)
    if (index % 100 === 25) {
      const items = Array.from({ length: 3 }, () => `<li><p>${sentence(next, 6)}</p></li>`)
      blocks.push(`<ul>${items.join('')}</ul>`)
    }
    blocks.push(`<p>${inline(next)}</p>`)
  }
  return blocks.join('')
}

export function tableHtml({ rows = 200, columns = 5, seed = 2 } = {}) {
  const next = random(seed)
  const header = Array.from(
    { length: columns },
    (_, column) => `<th><p>Sütun ${column + 1}</p></th>`,
  )
  const body = Array.from({ length: rows }, () => {
    const cells = Array.from({ length: columns }, () => `<td><p>${sentence(next, 3)}</p></td>`)
    return `<tr>${cells.join('')}</tr>`
  })
  return `<p>Tablo öncesi</p><table><tbody><tr>${header.join('')}</tr>${body.join('')}</tbody></table><p>Tablo sonrası</p>`
}

const WORD_HEAD =
  '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta name=Generator content="Microsoft Word 15"><style><!-- p.MsoNormal {margin:0cm;} p.MsoListParagraphCxSpFirst {margin-left:36pt;} --></style><!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]--></head><body lang=TR><!--StartFragment-->'
const WORD_TAIL = '<!--EndFragment--></body></html>'

function wordListItem(next, level) {
  return `<p class=MsoListParagraphCxSpMiddle style='margin-left:${36 * level}pt;mso-list:l0 level${level} lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span></span><![endif]>${sentence(next, 6)}<o:p></o:p></p>`
}

function wordParagraph(next) {
  return `<p class=MsoNormal><span style='font-size:11.0pt;font-family:"Calibri",sans-serif;color:black'>${sentence(next, 10)}</span> <b><span style='font-size:11.0pt'>${sentence(next, 3)}</span></b> <span style='color:#C00000'>${sentence(next, 4)}</span><o:p>&nbsp;</o:p></p>`
}

export function wordPasteHtml({ bytes = 500_000, seed = 3 } = {}) {
  const next = random(seed)
  const parts = [WORD_HEAD]
  let size = WORD_HEAD.length + WORD_TAIL.length
  let index = 0
  while (size < bytes) {
    const part = index % 10 < 7 ? wordParagraph(next) : wordListItem(next, (index % 2) + 1)
    parts.push(part)
    size += part.length
    index++
  }
  parts.push(WORD_TAIL)
  return parts.join('')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = resolve(process.argv[2] ?? 'test-results/perf-docs')
  mkdirSync(target, { recursive: true })
  const files = {
    'article.html': articleHtml(),
    'table.html': tableHtml(),
    'word-paste.html': wordPasteHtml(),
  }
  for (const [name, html] of Object.entries(files)) {
    writeFileSync(join(target, name), html)
    console.log(`${name}: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`)
  }
}

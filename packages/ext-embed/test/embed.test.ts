import { Editor, type EditorOptions } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { NodeSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { activateEmbeds } from '../src/activate.js'
import {
  buildEmbedSrc,
  Embed,
  type EmbedOptions,
  isAllowedEmbedSrc,
  matchEmbedUrl,
} from '../src/index.js'

let editors: Editor[] = []

async function mount(
  options: Partial<EmbedOptions> = {},
  editorOptions: EditorOptions = {},
): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, {
    extensions: [...basicExtensions, Embed.configure(options)],
    ...editorOptions,
  })
  editors.push(editor)
  return editor
}

const viewOf = (editor: Editor): EditorView => (editor as unknown as { view: EditorView }).view

function paste(editor: Editor, text: string): void {
  const data = new Map([['text/plain', text]])
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', {
    value: { getData: (type: string) => data.get(type) ?? '', files: [], types: [...data.keys()] },
  })
  editor.dom.dispatchEvent(event)
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('matchEmbedUrl', () => {
  it('recognises YouTube, Vimeo and Spotify links with start times', () => {
    expect(matchEmbedUrl('https://youtu.be/dQw4w9WgXcQ?t=1m30s')).toMatchObject({
      provider: 'youtube',
      id: 'dQw4w9WgXcQ',
      start: 90,
    })
    expect(matchEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ')
    expect(matchEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ')
    expect(matchEmbedUrl('https://vimeo.com/76979871/8272103f6e#t=45s')).toMatchObject({
      provider: 'vimeo',
      id: '76979871',
      hash: '8272103f6e',
      start: 45,
    })
    expect(
      matchEmbedUrl('https://open.spotify.com/intl-tr/track/4uLU6hMCjMI75M1A2tKUQC?si=x'),
    ).toMatchObject({ provider: 'spotify', id: 'track:4uLU6hMCjMI75M1A2tKUQC' })
  })

  it('rejects look-alike hosts, injected ids and unsafe schemes', () => {
    const rejected = [
      'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
      'https://evil.com/?u=youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com@evil.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=../../redirect?q=evil',
      'https://www.youtube.com/watch?v=dQw4w9WgXc%2F',
      'https://www.youtube.com/redirect?q=https://evil.com',
      'javascript:alert(1)//youtu.be/dQw4w9WgXcQ',
      'data:text/html,youtu.be/dQw4w9WgXcQ',
      'https://vimeo.com/channels/staffpicks',
      'https://spoti.fi/abc',
      'spotify:track:4uLU6hMCjMI75M1A2tKUQC',
      'https://www.dailymotion.com/video/x7tgad0',
    ]
    for (const url of rejected) expect(matchEmbedUrl(url), url).toBeNull()
  })

  it('builds sources only from validated parts and recognises them back', () => {
    const src = buildEmbedSrc({ provider: 'youtube', id: 'dQw4w9WgXcQ', start: 90 })

    expect(src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90')
    expect(isAllowedEmbedSrc(src)).toBe(true)
    expect(buildEmbedSrc({ provider: 'youtube', id: 'dQw4w9WgXcQ', start: '1&list=x' })).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    )
    expect(buildEmbedSrc({ provider: 'constructor', id: 'x' })).toBeNull()
    expect(buildEmbedSrc({ provider: 'youtube', id: '../x?y=1#z' })).toBeNull()
    expect(
      isAllowedEmbedSrc('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&x=1'),
    ).toBe(false)
  })
})

describe('embed schema', () => {
  it('turns a pasted YouTube iframe into a sandboxed, rebuilt player', async () => {
    const editor = await mount(
      {},
      {
        content:
          '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Demo" style="position:fixed" onload="alert(1)" sandbox="allow-top-navigation" srcdoc="<script>alert(1)</script>"></iframe>',
      },
    )

    const html = editor.getHTML()

    expect(html).toContain('data-embed="youtube" data-id="dQw4w9WgXcQ" data-title="Demo"')
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"')
    expect(html).toContain(
      'sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"',
    )
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"')
    expect(html).not.toMatch(/srcdoc|onload|allow-top-navigation|position:fixed/)
  })

  it('drops iframes from other sites and never parses object or embed tags', async () => {
    const editor = await mount(
      {},
      {
        content:
          '<p>a</p><iframe src="https://evil.com/frame"></iframe><object data="https://evil.com/x"></object><embed src="https://evil.com/x">',
      },
    )
    expect(editor.getHTML()).toBe('<p>a</p>')
  })

  it('renders an inert block when JSON content carries a bad embed', async () => {
    const editor = await mount(
      {},
      {
        content: {
          type: 'doc',
          content: [{ type: 'embed', attrs: { provider: 'youtube', id: '"><script>' } }],
        },
      },
    )
    expect(editor.getHTML()).toBe('<div data-embed-invalid=""></div>')
    expect(editor.dom.querySelector('.vive-embed.is-invalid')).not.toBeNull()
  })

  it('reads the wrapper data instead of the iframe inside it', async () => {
    const editor = await mount(
      {},
      {
        content:
          '<div data-embed="vimeo" data-id="76979871" data-hash="8272103f6e"><iframe src="https://evil.com"></iframe></div>',
      },
    )
    expect(editor.getHTML()).toContain(
      'src="https://player.vimeo.com/video/76979871?dnt=1&amp;h=8272103f6e"',
    )
    expect(editor.getHTML()).not.toContain('evil.com')
  })

  it('writes a link instead of a player when facade output is on', async () => {
    const editor = await mount(
      { facade: true },
      {
        content: '<div data-embed="youtube" data-id="dQw4w9WgXcQ" data-title="Demo"></div>',
      },
    )
    expect(editor.getHTML()).toBe(
      '<div class="vive-embed" data-embed="youtube" data-id="dQw4w9WgXcQ" data-title="Demo"><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" rel="noopener noreferrer">Demo</a></div>',
    )
  })
})

describe('embed editing', () => {
  it('shows a facade that loads nothing until the play button is pressed', async () => {
    const editor = await mount(
      { labels: { play: 'Oynat', invalid: 'Desteklenmiyor' } },
      {
        content: '<div data-embed="youtube" data-id="dQw4w9WgXcQ" data-title="Demo"></div>',
      },
    )
    const button = editor.dom.querySelector<HTMLButtonElement>('.vive-embed-play')

    expect(editor.dom.querySelector('iframe')).toBeNull()
    expect(button?.getAttribute('aria-label')).toBe('Oynat: Demo (YouTube)')
    button?.click()

    const frame = editor.dom.querySelector('iframe')
    expect(frame?.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1',
    )
    expect(frame?.getAttribute('allow')).toContain('autoplay')
  })

  it('inserts from a supported address and refuses others and the embed cap', async () => {
    const editor = await mount({ maxEmbeds: 1 }, { content: '<p>Metin</p>' })

    expect(editor.commands.insertEmbed('https://evil.com/video')).toBe(false)
    expect(editor.commands.insertEmbed('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(editor.can.insertEmbed('https://vimeo.com/76979871')).toBe(false)
    expect(editor.getHTML()).toMatch(/^<p>Metin<\/p><div class="vive-embed" data-embed="youtube"/)
  })

  it('counts embeds inside a quote toward the cap and frees it after one is removed', async () => {
    const editor = await mount(
      { maxEmbeds: 2 },
      {
        content:
          '<blockquote><div data-embed="youtube" data-id="dQw4w9WgXcQ"></div><p>a</p></blockquote><div data-embed="vimeo" data-id="76979871"></div><p>b</p>',
      },
    )
    const capped = editor.can.insertEmbed('https://youtu.be/dQw4w9WgXcQ')
    const view = viewOf(editor)
    view.dispatch(view.state.tr.delete(0, view.state.doc.child(0).nodeSize))

    const freed = editor.can.insertEmbed('https://youtu.be/dQw4w9WgXcQ')

    expect(capped).toBe(false)
    expect(freed).toBe(true)
  })

  it('sets the accessible title of the selected embed', async () => {
    const editor = await mount(
      {},
      {
        content: '<div data-embed="youtube" data-id="dQw4w9WgXcQ"></div><p>x</p>',
      },
    )
    const view = viewOf(editor)
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, 0)))

    editor.commands.setEmbedTitle('Tanıtım\u0000 videosu')

    expect(editor.query.selectedEmbed()?.title).toBe('Tanıtım  videosu')
    expect(editor.getHTML()).toContain('title="Tanıtım  videosu"')
  })

  it('turns a pasted bare link on an empty line into an embed that one undo turns back', async () => {
    const editor = await mount({}, { content: '<p></p>' })

    paste(editor, 'https://youtu.be/dQw4w9WgXcQ')

    expect(editor.getHTML()).toContain('data-embed="youtube"')
    editor.commands.undo()
    expect(editor.getHTML()).toBe('<p>https://youtu.be/dQw4w9WgXcQ</p>')
  })
})

describe('activateEmbeds', () => {
  it('replaces a facade link with a rebuilt player on click', () => {
    document.body.innerHTML =
      '<div data-embed="youtube" data-id="dQw4w9WgXcQ"><a href="https://evil.com">Demo</a></div><div data-embed="youtube" data-id="bad"><a href="#">x</a></div>'

    activateEmbeds()
    for (const link of document.querySelectorAll('a')) link.click()

    const frames = document.querySelectorAll('iframe')
    expect(frames).toHaveLength(1)
    expect(frames[0]?.getAttribute('src')).toBe(
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1',
    )
  })
})

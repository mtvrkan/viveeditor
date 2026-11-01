import { Editor, type EditorOptions } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanMention, cleanMentionLabel, isMentionId, Mention } from '../src/index.js'

let editors: Editor[] = []

async function mount(options: EditorOptions = {}): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, {
    extensions: [...basicExtensions, Mention],
    ...options,
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('isMentionId', () => {
  it('accepts opaque ids up to 128 characters', () => {
    expect(isMentionId('u_42')).toBe(true)
    expect(isMentionId('team:design@acme')).toBe(true)
    expect(isMentionId(`a${'b'.repeat(127)}`)).toBe(true)
  })

  it('rejects path-like, oversized, untrimmed, scheme-like and non-ascii ids', () => {
    for (const id of [
      '',
      '../admin',
      'a..b',
      '-lead',
      `a${'b'.repeat(128)}`,
      'u1\n',
      ' u1',
      'ü1',
      '１２',
      'javascript:alert(1)',
      42,
    ]) {
      expect(isMentionId(id)).toBe(false)
    }
  })
})

describe('cleanMentionLabel', () => {
  it('strips control and bidi characters, the leading @ and caps at 100 code points', () => {
    expect(cleanMentionLabel('@‮Deniz\u0000  Aydın\n')).toBe('Deniz Aydın')
    expect(Array.from(cleanMentionLabel('😀'.repeat(150)))).toHaveLength(100)
  })

  it('drops a space left at the end after cutting at the limit', () => {
    expect(cleanMentionLabel(`${'a'.repeat(99)} b`)).toBe('a'.repeat(99))
  })

  it('falls back to the id when the label is empty', () => {
    expect(cleanMention({ id: 'u1', label: '‮' })).toEqual({ id: 'u1', label: 'u1' })
    expect(cleanMention({ id: '../x', label: 'Ali' })).toBeNull()
  })
})

describe('Mention extension', () => {
  it('parses and renders a mention as a span with an opaque id', async () => {
    const editor = await mount({
      content: '<p>Merhaba <span class="vive-mention" data-mention="u1">@Deniz</span></p>',
    })

    expect(editor.getHTML()).toBe(
      '<p>Merhaba <span class="vive-mention" data-mention="u1">@Deniz</span></p>',
    )
  })

  it('drops a mention with an invalid id and never renders html from the label', async () => {
    const editor = await mount({
      content:
        '<p><span data-mention="../admin">@x</span><span data-mention="u2"><img src=x onerror=alert(1)>@Ali</span></p>',
    })

    expect(editor.getHTML()).toBe(
      '<p>@x<span class="vive-mention" data-mention="u2">@Ali</span></p>',
    )
  })

  it('inserts a mention followed by a space and validates the input', async () => {
    const editor = await mount({ content: '<p></p>' })

    expect(editor.commands.insertMention({ id: 'bad id', label: 'X' })).toBe(false)
    expect(editor.commands.insertMention({ id: 'u3', label: '<b>Ayşe</b>' })).toBe(true)

    expect(editor.getHTML()).toBe(
      '<p><span class="vive-mention" data-mention="u3">@&lt;b&gt;Ayşe&lt;/b&gt;</span>&nbsp;</p>',
    )
  })

  it('rejects JSON content with an invalid id', async () => {
    const editor = await mount({ content: '<p>a</p>' })

    expect(() =>
      editor.setContent({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'mention', attrs: { id: '../x', label: 'x' } }] },
        ],
      }),
    ).toThrow()
    expect(editor.getHTML()).toBe('<p>a</p>')
  })

  it('refuses to insert in a read-only editor', async () => {
    const editor = await mount({ content: '<p>a</p>', editable: false })

    expect(editor.commands.insertMention({ id: 'u1', label: 'Ali' })).toBe(false)
    expect(editor.getHTML()).toBe('<p>a</p>')
  })
})

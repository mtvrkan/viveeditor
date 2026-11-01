import type { Editor } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import { h } from './dom.js'
import { type IconName, icon } from './icons.js'
import type { MenuItem } from './menu.js'
import { format, type Messages } from './messages.js'
import { BLOCKS, type BlockSpec } from './tools.js'

const WRAPPERS = ['taskList', 'orderedList', 'bulletList', 'blockquote'] as const

export interface BlockControl {
  readonly button: HTMLButtonElement
  readonly available: boolean
  readonly items: MenuItem[]
  sync(): void
}

export function createBlockControl(
  editor: Editor,
  commands: CommandAccess,
  messages: Messages,
): BlockControl {
  const menuBlocks = BLOCKS.filter((block) => block.menu && commands.has(block.command))
  const text = h('span', { class: 've-type-label' })
  const visual = h('span', { class: 've-type-icon' })
  const button = h('button', { type: 'button', class: 've-type' }, [visual, text, icon('chevron')])
  let iconName: IconName | null = null

  const isBlockActive = (block: BlockSpec): boolean =>
    block.active ? editor.isActive(block.active, block.activeAttrs ?? {}) : false

  const iconOfBlock = (id: string): IconName =>
    id.startsWith('heading')
      ? 'heading'
      : (BLOCKS.find((block) => block.id === id)?.icon ?? 'paragraph')

  const current = (): { id: string; label: string } => {
    const level = editor.getAttributes('heading').level
    if (typeof level === 'number') {
      return { id: `heading${level}`, label: format(messages.heading, { level }) }
    }
    if (commands.has('toggleCodeBlock') && editor.isActive('codeBlock')) {
      return { id: 'codeBlock', label: messages.codeBlock }
    }
    for (const id of WRAPPERS) {
      if (
        commands.has(BLOCKS.find((block) => block.id === id)?.command ?? '') &&
        editor.isActive(id)
      ) {
        return { id, label: messages[id] }
      }
    }
    return { id: 'paragraph', label: messages.paragraph }
  }

  const apply = (block: BlockSpec): void => {
    if (block.id !== 'codeBlock' && current().id === 'codeBlock') commands.run('toggleCodeBlock')
    if (block.id === 'paragraph') {
      for (const id of WRAPPERS) {
        const wrapper = BLOCKS.find((candidate) => candidate.id === id)
        if (wrapper && editor.isActive(id)) commands.run(wrapper.command)
      }
      commands.run('setParagraph')
      return
    }
    if (isBlockActive(block)) return
    commands.run(block.command, ...(block.args ? [block.args] : []))
  }

  const items = menuBlocks.map<MenuItem>((block) => ({
    id: block.id,
    label: format(messages[block.label], block.labelValues ?? {}),
    icon: block.icon,
    hint: block.hint,
    role: 'menuitemradio',
    checked: () => current().id === block.id,
    action: () => apply(block),
  }))

  const sync = (): void => {
    const block = current()
    text.textContent = block.label
    const nextIcon = iconOfBlock(block.id)
    if (nextIcon !== iconName) {
      iconName = nextIcon
      visual.replaceChildren(icon(nextIcon))
    }
    button.setAttribute('aria-label', `${messages.blockType}: ${block.label}`)
  }

  return { button, available: menuBlocks.length > 1, items, sync }
}

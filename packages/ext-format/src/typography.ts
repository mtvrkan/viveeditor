import { defineExtension, type Extension, textInputRule } from '@viveeditor/core'

type Rule = ReturnType<typeof textInputRule>

export interface TypographyOptions {
  quotes: readonly [string, string, string, string] | null
  dashes: boolean
  symbols: boolean
}

const OPENS_AFTER = `(?:^|[\\s{[(<'"\\u2018\\u201C\\u201E\\u00AB])`

export const Typography: Extension<TypographyOptions> = defineExtension({
  name: 'typography',
  defaultOptions: { quotes: ['“', '”', '‘', '’'], dashes: true, symbols: true },
  inputRules: ({ options }) => {
    const rules: Rule[] = []
    if (options.quotes) {
      const [openDouble, closeDouble, openSingle, closeSingle] = options.quotes
      rules.push(
        textInputRule(new RegExp(`${OPENS_AFTER}(")$`), openDouble),
        textInputRule(/"$/, closeDouble),
        textInputRule(new RegExp(`${OPENS_AFTER}(')$`), openSingle),
        textInputRule(/'$/, closeSingle),
      )
    }
    if (options.dashes) rules.push(textInputRule(/(?<!^)--$/, '—'))
    if (options.symbols) {
      rules.push(
        textInputRule(/\.\.\.$/, '…'),
        textInputRule(/\([cC]\)$/, '©'),
        textInputRule(/\([rR]\)$/, '®'),
        textInputRule(/\([tT][mM]\)$/, '™'),
        textInputRule(/(?<!-)->$/, '→'),
        textInputRule(/<-$/, '←'),
      )
    }
    return rules
  },
})

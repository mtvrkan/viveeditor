import { ViveEditor } from '@viveeditor/react'
import { createElement, StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { LABEL, pageParts, SAMPLE_VALUE, START_VALUE } from './page.js'

const { host, output, sample } = pageParts()

function App() {
  const [value, setValue] = useState(START_VALUE)

  useEffect(() => {
    output.textContent = value
  }, [value])

  useEffect(() => {
    const load = () => setValue(SAMPLE_VALUE)
    sample.addEventListener('click', load)
    return () => sample.removeEventListener('click', load)
  }, [])

  return createElement(ViveEditor, { value, onChange: setValue, locale: 'tr', label: LABEL })
}

createRoot(host).render(createElement(StrictMode, null, createElement(App)))

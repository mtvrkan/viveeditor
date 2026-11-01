import { mount } from 'svelte'
import { pageParts } from './page.js'
import SvelteDemo from './SvelteDemo.svelte'

const { host, output, sample } = pageParts()

mount(SvelteDemo, { target: host, props: { output, sample } })

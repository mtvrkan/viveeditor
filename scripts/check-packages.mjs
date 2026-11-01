import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url))
const bin = (name) => root(`node_modules/.bin/${name}`)

const packages = readdirSync(root('packages'))
  .map((dir) => ({
    dir,
    pkg: JSON.parse(readFileSync(root(`packages/${dir}/package.json`), 'utf8')),
  }))
  .filter(({ pkg }) => !pkg.private)

const SVELTE_COMPONENT_TYPES = { '@viveeditor/svelte': ['internal-resolution-error'] }

const out = mkdtempSync(join(tmpdir(), 'viveeditor-pack-'))
const failures = []

const run = (command, args, cwd) => {
  try {
    execFileSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' })
    return null
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}`.trim() || String(error)
  }
}

const workspaceRanges = (manifest) =>
  ['dependencies', 'peerDependencies', 'optionalDependencies']
    .flatMap((field) => Object.entries(manifest[field] ?? {}))
    .filter(([, range]) => String(range).startsWith('workspace:'))
    .map(([name, range]) => `${name}@${range}`)

try {
  for (const { dir, pkg } of packages) {
    const cwd = root(`packages/${dir}`)
    const packed = execFileSync('pnpm', ['pack', '--pack-destination', out], {
      cwd,
      encoding: 'utf8',
    })
    const tarball = packed.trim().split('\n').at(-1).trim()
    const manifest = JSON.parse(
      execFileSync('tar', ['-xzOf', tarball, 'package/package.json'], { encoding: 'utf8' }),
    )
    const problems = []
    const leaked = workspaceRanges(manifest)
    if (leaked.length > 0) problems.push(`workspace ranges left: ${leaked.join(', ')}`)
    for (const field of ['repository', 'license', 'engines']) {
      if (!manifest[field]) problems.push(`missing "${field}"`)
    }
    const files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split('\n')
    if (!files.includes('package/README.md')) problems.push('README.md not packed')
    if (!files.includes('package/LICENSE')) problems.push('LICENSE not packed')
    const lint = run(bin('publint'), ['run', tarball, '--strict'], cwd)
    if (lint) problems.push(`publint:\n${lint}`)
    const entrypoints = Object.keys(manifest.exports ?? { '.': null }).filter(
      (entry) => !/\.(css|json)$/.test(entry),
    )
    if (entrypoints.length > 0) {
      const ignored = SVELTE_COMPONENT_TYPES[pkg.name] ?? []
      const types = run(
        bin('attw'),
        [
          tarball,
          '--profile',
          'esm-only',
          '--format',
          'ascii',
          '--entrypoints',
          ...entrypoints,
          ...(ignored.length > 0 ? ['--ignore-rules', ...ignored] : []),
        ],
        cwd,
      )
      if (types) problems.push(`attw:\n${types}`)
    }
    console.log(`${problems.length === 0 ? '✓' : '✗'} ${pkg.name}`)
    if (problems.length > 0) failures.push(`${pkg.name}\n  ${problems.join('\n  ')}`)
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

if (failures.length > 0) {
  console.error(`\n${failures.join('\n\n')}`)
  process.exit(1)
}
console.log(`\n${packages.length} packages checked.`)

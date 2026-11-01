import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url))
const [mode, outDir] = process.argv.slice(2)
if (mode !== 'check' && !(mode === 'pack' && outDir)) {
  console.error('Usage: node scripts/release-plan.mjs check | pack <dir>')
  process.exit(1)
}

const packages = readdirSync(root('packages'))
  .map((dir) => ({
    dir,
    pkg: JSON.parse(readFileSync(root(`packages/${dir}/package.json`), 'utf8')),
  }))
  .filter(({ pkg }) => !pkg.private)

const versions = new Set(packages.map(({ pkg }) => pkg.version))
if (versions.size !== 1) {
  console.error(`Packages must share one version, found: ${[...versions].join(', ')}`)
  process.exit(1)
}
const [version] = versions

const isPublished = (spec) => {
  try {
    execFileSync('npm', ['view', spec, 'version', '--json'], { stdio: 'pipe', encoding: 'utf8' })
    return true
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    if (output.includes('E404')) return false
    throw new Error(`npm view ${spec} failed:\n${output}`)
  }
}

const pending = packages.filter(({ pkg }) => !isPublished(`${pkg.name}@${pkg.version}`))

const internal = (pkg) =>
  ['dependencies', 'peerDependencies', 'optionalDependencies'].flatMap((field) =>
    Object.keys(pkg[field] ?? {}).filter((name) =>
      packages.some((entry) => entry.pkg.name === name),
    ),
  )

const ordered = []
const visit = (entry, trail = []) => {
  if (ordered.includes(entry)) return
  if (trail.includes(entry))
    throw new Error(`Dependency cycle: ${[...trail, entry].map((e) => e.pkg.name).join(' → ')}`)
  for (const name of internal(entry.pkg)) {
    visit(
      packages.find((candidate) => candidate.pkg.name === name),
      [...trail, entry],
    )
  }
  ordered.push(entry)
}
for (const entry of packages) visit(entry)
const queue = ordered.filter((entry) => pending.includes(entry))

if (mode === 'check') {
  const output = process.env.GITHUB_OUTPUT
  const publish = queue.length > 0
  if (output) appendFileSync(output, `publish=${publish}\nversion=${version}\n`)
  console.log(
    publish
      ? `${queue.length} packages to publish at ${version}: ${queue.map(({ pkg }) => pkg.name).join(', ')}`
      : `Every package is already published at ${version}.`,
  )
  process.exit(0)
}

const target = resolve(outDir)
mkdirSync(target, { recursive: true })
const lines = []
for (const { dir, pkg } of queue) {
  const packed = execFileSync('pnpm', ['pack', '--pack-destination', target], {
    cwd: root(`packages/${dir}`),
    encoding: 'utf8',
  })
  const tarball = packed.trim().split('\n').at(-1).trim()
  lines.push(`${basename(tarball)}\t${pkg.name}@${pkg.version}`)
}
writeFileSync(resolve(target, 'order.txt'), `${lines.join('\n')}\n`)
console.log(`Packed ${lines.length} packages into ${outDir} in dependency order.`)

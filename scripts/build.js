#!/usr/bin/env node
/**
 * Build the static site.
 *
 * The playground is plain ES modules, so there is nothing to bundle -- this
 * just lays the files out so a static host can serve them: the page at the
 * root, and the library below it (`../src/` becomes `./src/`, since nothing
 * above the publish directory is reachable).
 */

import { cp, mkdir, rm, readFile, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const out = process.argv[2] || 'dist'

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })

await cp('src', join(out, 'src'), { recursive: true })
await cp('web/index.html', join(out, 'index.html'))

const app = await readFile('web/app.js', 'utf8')
await writeFile(join(out, 'app.js'), app.replaceAll('../src/', './src/'))

// A 404 page keeps deep links from looking broken.
await writeFile(join(out, '404.html'),
  '<!doctype html><meta charset="utf-8"><title>not found</title>'
  + '<meta http-equiv="refresh" content="0;url=/">')

const files = []
async function walk(dir) {
  const { readdir } = await import('node:fs/promises')
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walk(p)
    else files.push(p)
  }
}
await walk(out)
let bytes = 0
for (const f of files) bytes += (await stat(f)).size
console.log(`${out}/  ${files.length} files, ${(bytes / 1024).toFixed(0)} kB`)

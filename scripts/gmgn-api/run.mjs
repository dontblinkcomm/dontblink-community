#!/usr/bin/env node
// Installed beside generate.mjs and verify.mjs in the artifact repository.
import { readFile, cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildRegistry, writeRegistry, sha256 } from './generate.mjs'
import { verifyDirectory } from './verify.mjs'
import { emptyLifecycleInput, refreshTheses, validateLifecycleInput } from './lifecycle.mjs'

export async function updateRegistry(root = process.cwd(), manifestPath = new URL('../lib/launchers.json', import.meta.url), options = {}) {
  const input = resolve(root, 'data/ours.json')
  const output = resolve(root, 'data/verified')
  const raw = await readFile(input, 'utf8')
  let lifecycleInput = emptyLifecycleInput()
  try {
    const old = JSON.parse(await readFile(resolve(output, 'index.json'), 'utf8'))
    if (old.lifecycle) { validateLifecycleInput(old.lifecycle.inputs); lifecycleInput = old.lifecycle.inputs }
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (options.refreshLifecycle) lifecycleInput = await refreshTheses(lifecycleInput, options)
  const registry = buildRegistry({ snapshot: JSON.parse(raw), manifest: JSON.parse(await readFile(manifestPath, 'utf8')), inputSha256: sha256(raw), lifecycleInput })
  // Stage outside the Git checkout: failed validation must not expose partial files to git add -A.
  const temporary = await mkdtemp(join(tmpdir(), 'dontblink-verified-'))
  const stage = join(temporary, 'verified')
  try {
    try { await cp(output, stage, { recursive: true }) } catch (error) { if (error.code !== 'ENOENT') throw error }
    await writeRegistry(stage, registry)
    await verifyDirectory(stage)
    // Refuse a concurrent writer changing our source while deriving the files.
    if (sha256(await readFile(input, 'utf8')) !== registry.index.source.sha256) throw new Error('ours.json changed during API generation')
    await cp(stage, output, { recursive: true })
    const result = await verifyDirectory(output)
    if (sha256(await readFile(input, 'utf8')) !== registry.index.source.sha256) throw new Error('ours.json changed before API validation completed')
    return { ...result, sourceSha256: registry.index.source.sha256 }
  } finally { await rm(temporary, { recursive: true, force: true }) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  updateRegistry().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1 })
}

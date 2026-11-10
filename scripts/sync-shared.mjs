// Copies the shared game logic and static data into the Edge Function folder.
// A deployed Supabase function can only rely on files under supabase/functions, so the
// function imports these copies. src/ is the source of truth: edit there, never in _shared.
// Runs automatically before `npm run dev` and `npm run build`.

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'supabase', 'functions', '_shared')

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const copied = []
for (const file of readdirSync(join(root, 'src', 'shared'))) {
  if (!file.endsWith('.ts')) continue
  cpSync(join(root, 'src', 'shared', file), join(out, file))
  copied.push(file)
}
for (const file of ['spots.json', 'backup-content.json']) {
  cpSync(join(root, 'src', 'data', file), join(out, file))
  copied.push(file)
}
writeFileSync(
  join(out, 'README.md'),
  '# Generated, do not edit\n\nThese files are copied from `src/shared` and `src/data` by `npm run sync`.\nEdit the originals and run `npm run sync` again.\n',
)

console.log(`sync-shared: copied ${copied.length} files to supabase/functions/_shared`)

// Prints the URLs to open for a multi-device test.
//
//   npm run links                 -> links for the local dev server (port 5173)
//   npm run links -- KRBQ         -> also prints the join and wizard links for room KRBQ
//   npm run links -- KRBQ https://have-we-met.vercel.app   -> same, for a deployed site

import { networkInterfaces } from 'node:os'

const args = process.argv.slice(2)
const code = args.find((a) => /^[a-z]{4}$/i.test(a))?.toUpperCase()
const site = args.find((a) => /^https?:\/\//.test(a))?.replace(/\/$/, '')

const lan = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => `http://${n.address}:5173`)

const bases = site ? [site] : ['http://localhost:5173', ...lan]

for (const base of bases) {
  console.log(`\n${base}`)
  console.log(`  Host screen (laptop on the projector):  ${base}/host`)
  console.log(`  Join (phones, or extra browser tabs):   ${base}/play${code ? `/${code}` : ''}`)
  console.log(`  Wizard console (hidden teammate):       ${base}/wizard/${code ?? 'CODE'}`)
  if (!site) console.log(`  Design preview with fake data:          ${base}/preview`)
}

console.log(`
Notes
- The room code appears on the host screen. Run "npm run links -- CODE" to get exact links.
- To test several players on one computer, open each /play link in its own private
  (incognito) window, or in different browser profiles. Normal tabs in one window share
  the same saved player, so they count as ONE player.
- Phones must use an http://192.168... address above (same wifi) or the deployed site.
  "localhost" only works on this computer.
- The mic and location only work over HTTPS (the deployed site) or on localhost. Over a
  plain http://192.168... address the quiz falls back to typing, which is expected.
`)

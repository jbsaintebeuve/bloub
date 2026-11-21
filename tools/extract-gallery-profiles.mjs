// Usage: node tools/extract-gallery-profiles.mjs /path/to/open-bot-avatar > src/bot/profils-galerie.ts
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { sonde } from '../src/bot/avatar-import-profil.ts'
import { pathToFileURL } from 'node:url'

const upstream = resolve(process.argv[2] ?? '.')
const commit = '5e64c081971eb296f562544641bad37d40fb36b6'
const head = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (head !== commit) throw new Error(`Open Bot Avatar doit être au commit ${commit}`)

const source = pathToFileURL(upstream + '/packages/core/src/')
const { parsePath, flattenPath } = await import(new URL('path.ts', source).href)
const { getExample } = await import(new URL('examples.ts', source).href)
const { PROFILE_SAMPLES } = await import('../src/bot/profiles.ts')

const presets = [
  ['egg', 50, 49], ['shield', 50, 50], ['ghost', 50, 50],
  ['book', 50, 53], ['brain', 50, 48], ['camera', 50, 51],
  ['rocket', 50, 46], ['chat', 49, 46], ['controller', 50, 45],
  ['lightbulb', 50, 43]
]

function contour(id) {
  return (getExample(id) ?? JSON.parse(readFileSync(resolve(upstream, 'gallery', id + '.json'), 'utf8'))).body.path
}

function rayon(polygones, cx, cy, angle) {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  let resultat = 0
  for (const points of polygones) {
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i]
      const [bx, by] = points[(i + 1) % points.length]
      const ex = bx - x
      const ey = by - y
      const determinant = dx * ey - dy * ex
      if (Math.abs(determinant) < 1e-9) continue
      const segment = ((x - cx) * dy - (y - cy) * dx) / determinant
      if (segment >= 0 && segment <= 1) {
        resultat = Math.max(resultat, ((x - cx) * ey - (y - cy) * ex) / determinant)
      }
    }
  }
  return resultat
}

console.log(`// Contours Open Bot Avatar 0.3.0 (MIT, voir LICENSE).
// https://github.com/DominikScholz/open-bot-avatar/tree/${commit}
// Généré par tools/extract-gallery-profiles.mjs.
`)
for (const [index, [id, cx, cy]] of presets.entries()) {
  const polygones = flattenPath(parsePath(contour(id)))
  const rayons = Array.from({ length: PROFILE_SAMPLES }, (_, i) =>
    rayon(polygones, cx, cy, i * 2 * Math.PI / PROFILE_SAMPLES)
  )
  const facteur = 1.08 / Math.max(...rayons)
  // Étoffe le corps étroit de la fusée pour laisser la place au grand regard.
  const arrondi = id === 'rocket' ? 0.25 : 0
  const valeurs = rayons.map((r) => (r * facteur * (1 - arrondi) + 1.08 * arrondi).toFixed(4))
  if (index > 0) console.log('')
  const diagnostic = sonde(polygones, cx, cy)
  if (!diagnostic.radial) {
    console.log(`// Adaptation : contour non radial à ${diagnostic.angleFautif.toFixed(1)}°, profil tiré du bord extérieur.`)
  } else if (diagnostic.approximation > 0.08 || diagnostic.aplatissement < 0.42) {
    const ecart = (100 * diagnostic.approximation).toFixed(1)
    const minMax = diagnostic.aplatissement.toFixed(2)
    console.log(`// Adaptation : écart radial ${ecart} %, rapport min/max ${minMax}.`)
  }
  if (arrondi) console.log(`// Rayons de la fusée interpolés à ${arrondi * 100} % vers le cercle pour dégager le regard.`)
  console.log(`export const ${id} = [`)
  for (let i = 0; i < valeurs.length; i += 8) {
    console.log(`  ${valeurs.slice(i, i + 8).join(', ')}${i + 8 < valeurs.length ? ',' : ''}`)
  }
  console.log(']')
}

import { describe, expect, it } from 'vitest'
import { MAX_DESCRIPTION, nettoieDescription, promptGeneration, promptReparation } from './avatar-import-prompt'

/**
 * Les prompts sont l'AUTRE validation : ce qui est demande a l'agent externe
 * doit annoncer exactement les regles que `importerAvatar` verifiera, sinon
 * la boucle de reparation ne convergera jamais. Ces tests verrouillent le
 * contenu essentiel des deux prompts et l'insertion borne de la description.
 */

describe('prompt de generation', () => {
  it('porte la description telle quelle', () => {
    const p = promptGeneration('un robot avocat tres vert')
    expect(p).toContain('un robot avocat tres vert')
  })

  it('tombe sur un sujet par defaut quand la description est vide', () => {
    expect(promptGeneration('   ')).toContain('a cute round bot companion')
  })

  it('annonce la sortie attendue : JSON seul, sur une ligne', () => {
    const p = promptGeneration('test')
    expect(p).toContain('Reply with ONLY the JSON')
    expect(p).toContain('"version":1')
    expect(p).toContain('{"path":"M… Z"}')
  })

  it('annonce les regles radiales que l’import verifie', () => {
    const p = promptGeneration('test')
    expect(p).toContain('RADIAL PROFILE of 64 rays')
    expect(p).toContain('ONE single closed outline')
    expect(p).toContain('42%')
  })

  it('est deterministe', () => {
    expect(promptGeneration('un rond')).toBe(promptGeneration('un rond'))
  })
})

describe('nettoyage de la description', () => {
  it('collapse les espaces et trim les bords', () => {
    expect(nettoieDescription('  un   rond  ')).toBe('un rond')
  })

  it('borne la description a MAX_DESCRIPTION caracteres', () => {
    const longue = 'a'.repeat(MAX_DESCRIPTION + 50)
    const coupee = nettoieDescription(longue)
    expect(coupee.length).toBe(MAX_DESCRIPTION)
    expect(coupee.endsWith('…')).toBe(true)
  })
})

describe('prompt de reparation', () => {
  it('porte le JSON refuse et chaque diagnostic en anglais', () => {
    const message = 'version must be 1'
    const p = promptReparation('un bot rond', '{"version":2}', [message])
    expect(p).toContain('{"version":2}')
    expect(p).toContain('- version must be 1')
    expect(p).toContain('Reply with ONLY the corrected JSON')
    expect(p).toContain('un bot rond')
  })

  it('rappelle la contrainte radiale propre a Bloub', () => {
    const p = promptReparation('', 'x', ['e'])
    expect(p).toContain('star-shaped around the eyes')
    expect(p).not.toContain('The avatar to draw is still:')
  })

  it('tronque un JSON degenere au lieu d’exploser le prompt', () => {
    const p = promptReparation('', 'x'.repeat(5000), ['e'])
    expect(p.length).toBeLessThan(5000)
    expect(p).toContain('truncated')
  })
})

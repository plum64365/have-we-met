// Checks the pure game logic with fake players, with no browser and no Supabase.
// Run with: npm run test:logic   (needs Node 22.18+ or 24, which can import .ts files)

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildBackupContent, fitWitCount } from '../src/shared/backup.ts'
import { averageLocation, estimateMinutes, rankSpots } from '../src/shared/geo.ts'
import { eligibleVoters, jumpTo, nextStep, skipGameStep, skipPromptStep } from '../src/shared/machine.ts'
import { aiNames, funFacts, groupProfile, interestCounts, strongestPairs } from '../src/shared/profile.ts'
import { INTERESTS } from '../src/shared/quiz.ts'
import { validateContent } from '../src/shared/validate.ts'

const load = (file) => JSON.parse(readFileSync(new URL(`../src/data/${file}`, import.meta.url), 'utf8'))
const BACKUP = load('backup-content.json')
const SPOTS = load('spots.json')

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log(`  ok  ${name}`)
}

const NAMES = ['Maya', 'Dev', 'Sam', 'Priya', 'Leo', 'Ana']
function makePlayers(n) {
  return NAMES.slice(0, n).map((name, i) => ({
    id: `p${i}`,
    room_id: 'r1',
    name,
    avatar: 'yellow',
    interests: ['Food', INTERESTS[(i % 5) + 1], INTERESTS[(i % 3) + 6]],
    voice_text: i % 2 ? 'I have been baking bread every weekend' : '',
    this_or_that: { sleep: i < 4 ? 'b' : 'a', social: 'a', taste: i % 2 ? 'a' : 'b', place: 'a', plan: 'b' },
    shared_location: false,
    quiz_done: true,
    joined_at: `2026-11-10T10:00:0${i}Z`,
    last_seen: '2026-11-10T10:00:00Z',
  }))
}

function makeRoom(players, quick = true) {
  const witCount = quick ? 2 : players.length
  return {
    id: 'r1',
    code: 'KRBQ',
    phase: 'common_ground',
    phase_data: {},
    rev: 0,
    content: buildBackupContent(players, BACKUP, SPOTS, { witCount }),
    content_source: 'backup',
    build_status: 'ready',
    quick_play: quick,
    round: 1,
    created_at: '2026-11-10T10:00:00Z',
  }
}

const ctxFor = (players) => ({ playerNames: players.map((p) => p.name), spotIds: SPOTS.map((s) => s.id) })

console.log('Static content')
test('every interest has a complete backup category', () => {
  for (const interest of INTERESTS) {
    const cat = BACKUP.categories[interest]
    assert.ok(cat, `missing category ${interest}`)
    assert.equal(cat.tierlist.items.length, 8, `${interest} tier items`)
    assert.equal(new Set(cat.tierlist.items).size, 8, `${interest} duplicate tier items`)
    assert.ok(cat.wit.length >= 3, `${interest} wit templates`)
    for (const level of ['light', 'real', 'deep']) assert.ok(cat.realtalk[level].length >= 1, `${interest} ${level}`)
    assert.ok(SPOTS.some((s) => s.good_for.includes(interest) || cat.hangout.spot_categories.includes(s.category)))
  }
  assert.ok(BACKUP.general.wit.length >= 8)
})
test('spots are well formed, unique and marked as placeholders', () => {
  assert.ok(SPOTS.length >= 15)
  assert.equal(new Set(SPOTS.map((s) => s.id)).size, SPOTS.length)
  for (const s of SPOTS) {
    assert.ok(s.name && s.category && typeof s.lat === 'number' && typeof s.lng === 'number' && s.minutes > 0)
    assert.equal(s.placeholder, true)
  }
})
test('no banned words in the backup content', () => {
  assert.doesNotMatch(JSON.stringify(BACKUP), /quiplash|jackbox/i)
})

console.log('Backup builder + validator')
for (const n of [2, 3, 6]) {
  for (const quick of [true, false]) {
    test(`${n} players, ${quick ? 'quick play' : 'full game'}: backup content is valid`, () => {
      const players = makePlayers(n)
      const witCount = quick ? 2 : n
      const content = buildBackupContent(players, BACKUP, SPOTS, { witCount })
      const result = validateContent(content, ctxFor(players))
      assert.ok(result.ok, result.error)
      assert.equal(content.wit.length, witCount)
      assert.equal(new Set(content.wit.map((w) => w.prompt)).size, witCount, 'prompts are unique')
      for (const w of content.wit) {
        assert.equal(w.players.length, 2)
        assert.notEqual(w.players[0], w.players[1])
        assert.doesNotMatch(w.prompt, /\{name\}|\{interest\}/)
      }
      assert.ok(content.fun_facts.length >= 2 && content.fun_facts.length <= 3)
      assert.ok(content.hangout.why.length >= 2)
      if (!quick) {
        // Full game: everyone answers the same number of prompts (twice each).
        const turns = {}
        for (const w of content.wit) for (const name of w.players) turns[name] = (turns[name] ?? 0) + 1
        assert.deepEqual([...new Set(Object.values(turns))], [2])
      }
    })
  }
}
test('players who skipped the whole quiz still get a valid game', () => {
  const players = makePlayers(3).map((p) => ({ ...p, interests: [], this_or_that: {}, voice_text: null }))
  const content = buildBackupContent(players, BACKUP, SPOTS, { witCount: 2 })
  assert.ok(validateContent(content, ctxFor(players)).ok)
})
test('a different seed gives different prompts ("Play again")', () => {
  const players = makePlayers(4)
  const a = buildBackupContent(players, BACKUP, SPOTS, { witCount: 2, seed: 0 })
  const b = buildBackupContent(players, BACKUP, SPOTS, { witCount: 2, seed: 1 })
  assert.notDeepEqual(a.wit.map((w) => w.prompt), b.wit.map((w) => w.prompt))
})
test('validator rejects broken AI output with a clear message', () => {
  const players = makePlayers(3)
  const good = buildBackupContent(players, BACKUP, SPOTS, { witCount: 2 })
  const ctx = ctxFor(players)
  assert.equal(validateContent('nope', ctx).ok, false)
  assert.equal(validateContent({ ...good, tierlist: { ...good.tierlist, items: ['a', 'b'] } }, ctx).ok, false)
  assert.equal(validateContent({ ...good, realtalk: { ...good.realtalk, deep: ['only one'] } }, ctx).ok, false)
  assert.equal(validateContent({ ...good, wit: [] }, ctx).ok, false)
  assert.match(validateContent({ ...good, hangout: undefined }, ctx).error, /hangout/)
})
test('validator repairs unknown names, duplicate pairs and unknown spots', () => {
  const players = makePlayers(3)
  const good = buildBackupContent(players, BACKUP, SPOTS, { witCount: 2 })
  const result = validateContent(
    {
      ...good,
      wit: [
        { prompt: 'A', players: ['maya', 'Nobody'] },
        { prompt: 'B', players: ['Dev', 'Dev'] },
      ],
      hangout: { ...good.hangout, spot_id: 'made-up-place' },
    },
    ctxFor(players),
  )
  assert.ok(result.ok)
  for (const w of result.content.wit) {
    assert.equal(new Set(w.players).size, 2)
    for (const name of w.players) assert.ok(players.some((p) => p.name === name))
  }
  assert.equal(result.content.wit[0].players[0], 'Maya')
  assert.equal(result.content.hangout.spot_id, SPOTS[0].id)
})
test('fitWitCount trims and pads to the requested number of prompts', () => {
  const players = makePlayers(5)
  const content = buildBackupContent(players, BACKUP, SPOTS, { witCount: 3 })
  assert.equal(fitWitCount(content, players, BACKUP, 2).wit.length, 2)
  const padded = fitWitCount(content, players, BACKUP, 5)
  assert.equal(padded.wit.length, 5)
  assert.equal(new Set(padded.wit.map((w) => w.prompt)).size, 5)
})

console.log('Profile + geo')
test('interest counts, fun facts and pairs', () => {
  const players = makePlayers(6)
  assert.deepEqual(interestCounts(players)[0], { interest: 'Food', count: 6 })
  const facts = funFacts(players)
  assert.ok(facts.length >= 2 && facts.length <= 3)
  assert.ok(strongestPairs(players).length === 2)
  assert.ok(strongestPairs(players)[0].score >= strongestPairs(players)[1].score)
})
test('the AI profile has first names and no location', () => {
  const players = makePlayers(2).map((p, i) => ({ ...p, name: i ? 'Dev Patel' : 'Maya Lin' }))
  const { nameOf, aliases } = aiNames(players)
  const profile = JSON.stringify(groupProfile(players, nameOf))
  assert.ok(profile.includes('"Maya"') && !profile.includes('Lin'))
  assert.doesNotMatch(profile, /"lat"|"lng"|location/)
  assert.equal(aliases.dev, 'Dev Patel')
})
test('location: needs half the players, ranks nearest first', () => {
  const shores = { lat: 32.86, lng: -117.26 }
  assert.equal(averageLocation([shores], 3), null)
  assert.deepEqual(averageLocation([shores], 2), shores)
  const ranked = rankSpots(SPOTS, shores)
  assert.equal(ranked[0].id, 'la-jolla-shores')
  assert.equal(estimateMinutes(shores, ranked[0]) % 5, 0)
  assert.deepEqual(rankSpots(SPOTS, null).map((s) => s.id), SPOTS.map((s) => s.id))
})

console.log('Phase machine')
function play(n, { quick = true, offline = [] } = {}) {
  const players = makePlayers(n)
  let room = makeRoom(players, quick)
  const answers = []
  const onlineIds = players.map((p) => p.id).filter((id) => !offline.includes(id))
  const snap = () => ({ room, players, onlineIds, answers, now: 1_700_000_000_000 })
  const apply = (step) => {
    assert.ok(step, `no step from ${room.phase}`)
    room = { ...room, phase: step.phase, phase_data: step.phase_data, rev: room.rev + 1 }
  }
  const answerBoth = () => {
    for (const id of room.phase_data.pair) {
      answers.push({ id: `a${answers.length}`, room_id: 'r1', round: 1, prompt_index: room.phase_data.promptIndex, player_id: id, text: 'ha' })
    }
  }
  return { players, snap, apply, answerBoth, get room() { return room } }
}

for (const n of [2, 3, 6]) {
  test(`${n} players: full walk through every phase`, () => {
    const g = play(n)
    const seen = [g.room.phase]
    const go = () => {
      g.apply(nextStep(g.snap()))
      seen.push(g.room.phase)
    }
    go() // transition
    assert.deepEqual([g.room.phase_data.kind, g.room.phase_data.next], ['phones_away', 'tierlist'])
    go() // tierlist
    assert.equal(g.room.phase_data.scribeId, 'p0', 'scribe is the first player who joined')
    go() // transition
    assert.deepEqual([g.room.phase_data.kind, g.room.phase_data.next], ['phones_out', 'wit_answer'])
    for (let prompt = 0; prompt < 2; prompt++) {
      go()
      assert.equal(g.room.phase, 'wit_answer')
      assert.equal(g.room.phase_data.promptIndex, prompt)
      assert.equal(new Set(g.room.phase_data.pair).size, 2)
      assert.ok(g.room.phase_data.deadline)
      g.answerBoth()
      go()
      if (n === 2) {
        assert.equal(g.room.phase, 'wit_reveal', 'with 2 players the vote is skipped')
      } else {
        assert.equal(g.room.phase, 'wit_vote')
        assert.equal(eligibleVoters(g.snap()).length, n - 2, 'authors cannot vote')
        go()
        assert.equal(g.room.phase, 'wit_reveal')
      }
    }
    go() // transition
    assert.deepEqual([g.room.phase_data.kind, g.room.phase_data.next], ['phones_away', 'realtalk'])
    const firsts = []
    for (let q = 0; q < 9; q++) {
      go()
      assert.equal(g.room.phase, 'realtalk')
      assert.equal(g.room.phase_data.step, q)
      assert.ok(g.room.phase_data.question)
      firsts.push(g.room.phase_data.firstPlayerId)
    }
    assert.equal(new Set(firsts).size, n, 'everyone gets a turn to answer first')
    go()
    assert.equal(g.room.phase, 'hangout')
    assert.equal(nextStep(g.snap()), null)
  })
}
test('wit: no answers or one answer goes straight to the reveal', () => {
  const g = play(4)
  g.apply(jumpTo(g.snap(), 'wit_answer'))
  g.apply(nextStep(g.snap()))
  assert.equal(g.room.phase, 'wit_reveal')
})
test('full game uses one prompt per player and balances turns', () => {
  const g = play(5, { quick: false })
  g.apply(jumpTo(g.snap(), 'wit_answer'))
  let prompts = 1
  for (;;) {
    g.apply(skipPromptStep(g.snap()))
    if (g.room.phase !== 'wit_answer') break
    prompts++
  }
  assert.equal(prompts, 5)
  assert.deepEqual([...new Set(Object.values(g.room.phase_data.turns))], [2])
})
test('a dropped player is replaced in pairs, the scribe and the Real Talk order', () => {
  const g = play(4, { offline: ['p0', 'p1'] })
  g.apply(nextStep(g.snap()))
  g.apply(nextStep(g.snap()))
  assert.equal(g.room.phase_data.scribeId, 'p2', 'scribe falls to the next player')
  g.apply(skipGameStep(g.snap()))
  g.apply(nextStep(g.snap()))
  assert.deepEqual([...g.room.phase_data.pair].sort(), ['p2', 'p3'], 'pair adapts to who is left')
  g.apply(skipGameStep(g.snap()))
  g.apply(nextStep(g.snap()))
  assert.ok(['p2', 'p3'].includes(g.room.phase_data.firstPlayerId))
})
test('if presence looks dead (fewer than 2 online) everyone still plays', () => {
  const g = play(3, { offline: ['p0', 'p1', 'p2'] })
  g.apply(jumpTo(g.snap(), 'wit_answer'))
  assert.equal(g.room.phase, 'wit_answer')
  assert.equal(g.room.phase_data.pair.length, 2)
})
test('"Skip to next game" works from every game screen', () => {
  const g = play(4)
  g.apply(jumpTo(g.snap(), 'tierlist'))
  g.apply(skipGameStep(g.snap()))
  assert.equal(g.room.phase_data.next, 'wit_answer')
  g.apply(nextStep(g.snap()))
  g.apply(skipGameStep(g.snap()))
  assert.equal(g.room.phase_data.next, 'realtalk')
  g.apply(nextStep(g.snap()))
  g.apply(skipGameStep(g.snap()))
  assert.equal(g.room.phase, 'hangout')
})

console.log(`\n${passed} checks passed`)

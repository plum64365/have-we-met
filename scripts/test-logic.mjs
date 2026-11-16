// Checks the pure game logic with fake players, with no browser and no Supabase.
// Run with: npm run test:logic   (needs Node 22.18+ or 24, which can import .ts files)

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildBackupContent } from '../src/shared/backup.ts'
import { averageLocation, estimateMinutes, rankSpots } from '../src/shared/geo.ts'
import { jumpTo, nextStep, realTalkSequence, skipGameStep } from '../src/shared/machine.ts'
import { aiNames, funFacts, groupProfile, interestCounts, strongestPairs } from '../src/shared/profile.ts'
import { hangoutForSpot, matchingPlayers, rankHangoutSpots } from '../src/shared/hangout.ts'
import { userPrompt } from '../src/shared/prompts.ts'
import { VOICE_QUESTIONS } from '../src/shared/question-bank.ts'
import { INTERESTS, MAX_PLAYERS, realTalkQuestionsPerLevel, quizComplete, quizForRound, voiceAnswersFor } from '../src/shared/quiz.ts'
import { calendarForPlan, inviteUrl } from '../src/shared/community.ts'
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

const NAMES = ['Maya', 'Dev', 'Sam', 'Priya', 'Leo', 'Ana', 'Alex', 'Riley', 'Jordan', 'Casey', 'Morgan', 'Quinn']
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
    joined_at: `2026-11-10T10:00:${String(i).padStart(2, '0')}Z`,
    last_seen: '2026-11-10T10:00:00Z',
  }))
}

function makeRoom(players, quick = true) {
  return {
    id: 'r1',
    code: 'KRBQ',
    phase: 'common_ground',
    phase_data: {},
    rev: 0,
    content: buildBackupContent(players, BACKUP, SPOTS, {}),
    content_source: 'backup',
    build_status: 'ready',
    quick_play: quick,
    round: 1,
    created_at: '2026-11-10T10:00:00Z',
  }
}

const ctxFor = (players) => ({ playerNames: players.map((p) => p.name), spotIds: SPOTS.map((s) => s.id), questionsPerLevel: realTalkQuestionsPerLevel(players.length) })

console.log('Static content')
test('every interest has a complete backup category', () => {
  for (const interest of INTERESTS) {
    const cat = BACKUP.categories[interest]
    assert.ok(cat, `missing category ${interest}`)
    assert.equal(cat.tierlist.items.length, 8, `${interest} tier items`)
    assert.equal(new Set(cat.tierlist.items).size, 8, `${interest} duplicate tier items`)
    for (const level of ['light', 'real', 'deep']) assert.ok(cat.realtalk[level].length >= 1, `${interest} ${level}`)
    assert.ok(SPOTS.some((s) => s.good_for.includes(interest) || cat.hangout.spot_categories.includes(s.category)))
  }
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
for (const n of [2, 3, 6, 10, 12]) {
  test(`${n} players receive a valid two-game session`, () => {
    const players = makePlayers(n)
    const content = buildBackupContent(players, BACKUP, SPOTS)
    const result = validateContent(content, ctxFor(players))
    assert.ok(result.ok, result.error)
    assert.deepEqual(content.wit, [])
    assert.equal(realTalkSequence(content).length, realTalkQuestionsPerLevel(n) * 3)
    assert.ok(content.fun_facts.length >= 2)
  })
}
test('players who skipped the whole quiz still get a valid game', () => {
  const players = makePlayers(3).map((p) => ({ ...p, interests: [], this_or_that: {}, voice_text: null }))
  const content = buildBackupContent(players, BACKUP, SPOTS, {})
  assert.ok(validateContent(content, ctxFor(players)).ok)
})
test('a different seed gives different prompts ("Play again")', () => {
  const players = makePlayers(4)
  const a = buildBackupContent(players, BACKUP, SPOTS, { seed: 0 })
  const b = buildBackupContent(players, BACKUP, SPOTS, { seed: 1 })
  assert.notDeepEqual(a.realtalk, b.realtalk)
})
test('validator rejects broken AI output with a clear message', () => {
  const players = makePlayers(3)
  const good = buildBackupContent(players, BACKUP, SPOTS, {})
  const ctx = ctxFor(players)
  assert.equal(validateContent('nope', ctx).ok, false)
  assert.equal(validateContent({ ...good, tierlist: { ...good.tierlist, items: ['a', 'b'] } }, ctx).ok, false)
  assert.equal(validateContent({ ...good, realtalk: { ...good.realtalk, deep: ['only one'] } }, ctx).ok, false)
  assert.equal(validateContent({ ...good, wit: undefined }, ctx).ok, true)
  assert.match(validateContent({ ...good, hangout: undefined }, ctx).error, /hangout/)
})
test('legacy Wit content is ignored and invalid spots are repaired', () => {
  const players = makePlayers(3)
  const content = buildBackupContent(players, BACKUP, SPOTS)
  const result = validateContent({ ...content, wit: [{ prompt: 'Old prompt', players: ['A', 'B'] }], hangout: { ...content.hangout, spot_id: 'unknown' } }, ctxFor(players))
  assert.ok(result.ok)
  assert.deepEqual(result.content.wit, [])
  assert.equal(result.content.hangout.spot_id, SPOTS[0].id)
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
  assert.deepEqual(rankSpots(SPOTS, null).map((s) => s.minutes), SPOTS.map((s) => s.minutes).sort((a, b) => a - b))
})

console.log('Quiz variety and grounded generation')
test('all players get stable questions and six rounds exhaust each speaking pool before repeating', () => {
  const rounds = Array.from({ length: 6 }, (_, i) => quizForRound('same-room', i + 1))
  assert.deepEqual(rounds[0], quizForRound('same-room', 1))
  for (let category = 0; category < 3; category++) {
    assert.equal(new Set(rounds.map((q) => q.voice[category].id)).size, 6)
  }
  assert.equal(new Set(rounds.slice(0, 3).flatMap((q) => q.thisOrThat.map((t) => t.key))).size, 15)
  assert.equal(new Set(VOICE_QUESTIONS.map((q) => q.id)).size, VOICE_QUESTIONS.length)
})
test('legacy voice answers keep their question and passes differ from unanswered questions', () => {
  assert.equal(voiceAnswersFor({ voice_text: null }).length, 0)
  assert.equal(voiceAnswersFor({ voice_text: '' })[0].answer, '')
  const player = makePlayers(2)[1]
  const profile = groupProfile([player])
  assert.match(profile.players[0].voice_answers[0].question, /into lately/)
  assert.equal(profile.players[0].voice_answers[0].answer, player.voice_text)
  assert.equal(quizComplete({ ...player, quiz_round: 1 }, 2), false)
})
test('hypothetical voice answers reach the generator with their original question', () => {
  const player = { ...makePlayers(2)[0], voice_answers: [
    { question_id: 'free-trip', question: 'Where would you go on a free trip?', answer: 'Japan, to learn about food' },
    { question_id: 'into-lately', question: 'What are you into?', answer: '' },
  ] }
  const profile = groupProfile([player])
  assert.equal(profile.players[0].voice_answers.length, 1)
  assert.equal(profile.players[0].voice_answers[0].question_id, 'free-trip')
  assert.equal('into_lately' in profile.players[0], false)
  const prompt = userPrompt([player], SPOTS, (p) => p.name)
  assert.match(prompt, /Where would you go on a free trip/)
  assert.match(prompt, /good_for/)
  assert.match(prompt, /preferred_hangout/)
  assert.doesNotMatch(prompt, /"lat"|"lng"/)
})
test('hangout ranking counts distinct people and uses proximity to break ties', () => {
  const players = makePlayers(3).map((p, i) => ({ ...p, interests: i === 0 ? ['Food', 'Cooking', 'Anime'] : ['Tech'] }))
  const nearby = rankSpots(SPOTS, null)
  const ranked = rankHangoutSpots(players, nearby)
  const convoy = SPOTS.find((s) => s.id === 'convoy-street')
  assert.equal(matchingPlayers(players, convoy), 1)
  assert.equal(ranked[0].id, 'campus-game-lounge')
  assert.equal(matchingPlayers(players, ranked[0]), 2)
  assert.deepEqual(rankHangoutSpots(players.map((p) => ({ ...p, interests: [] })), SPOTS), SPOTS)
})
test('AI repairs replace mismatched activities and chips with the preferred recommendation', () => {
  const players = makePlayers(3)
  const ranked = rankHangoutSpots(players, SPOTS)
  const preferred = hangoutForSpot(players, ranked[0])
  const content = buildBackupContent(players, BACKUP, SPOTS, {})
  for (const spotId of ['made-up-place', SPOTS.find((s) => s.id !== preferred.spot_id).id]) {
    const checked = validateContent({ ...content, hangout: { activity: 'Cook in this cafe kitchen', spot_id: spotId, why: ['Invented trait', 'Invented price'] } }, { ...ctxFor(players), preferredHangout: preferred })
    assert.equal(checked.ok, true)
    assert.deepEqual(checked.content.hangout, preferred)
  }
  assert.deepEqual(content.hangout, preferred)
  for (const spot of SPOTS) {
    assert.ok(spot.activity.length <= 140, `${spot.id} activity is too long`)
    for (const chip of hangoutForSpot(players, spot).why) assert.ok(chip.split(/\s+/).length <= 5, chip)
  }
})
test('the validator rejects duplicate Real Talk questions and overly long tier items', () => {
  const players = makePlayers(3)
  const content = buildBackupContent(players, BACKUP, SPOTS, {})
  assert.equal(validateContent({ ...content, realtalk: { ...content.realtalk, deep: content.realtalk.light } }, ctxFor(players)).ok, false)
  assert.equal(validateContent({ ...content, tierlist: { ...content.tierlist, items: ['one two three four', ...content.tierlist.items.slice(1)] } }, ctxFor(players)).ok, false)
})

console.log('Two-game flow')
for (const n of [2, 6, 10, 12]) {
  test(`${n} players reach hangout with a turn to start Real Talk`, () => {
    const players = makePlayers(n)
    let room = makeRoom(players)
    const seen = []
    const starters = new Set()
    const snap = () => ({ room, players, onlineIds: players.map((p) => p.id), now: Date.now() })
    for (let i = 0; i < 30; i++) {
      seen.push(room.phase)
      if (room.phase === 'realtalk') starters.add(room.phase_data.firstPlayerId)
      const next = nextStep(snap())
      if (!next) break
      room = { ...room, ...next }
    }
    assert.equal(room.phase, 'hangout')
    assert.equal(starters.size, n)
    assert.ok(!seen.some((phase) => phase.startsWith('wit_')))
  })
}
test('sleeping phones stay in the twelve-person discussion roster', () => {
  const players = makePlayers(12)
  const room = makeRoom(players)
  const next = nextStep({ room, players, onlineIds: ['p0', 'p1'], now: 0 })
  assert.equal(next.phase_data.roster.length, 12)
})
test('old Wit phases and transitions resume into Real Talk', () => {
  const players = makePlayers(3)
  for (const phase of ['wit_answer', 'wit_vote', 'wit_reveal', 'transition']) {
    const room = { ...makeRoom(players), phase, phase_data: { next: 'wit_answer' } }
    const s = { room, players, onlineIds: players.map((p) => p.id), now: 0 }
    let next = nextStep(s)
    if (next.phase === 'transition') next = nextStep({ ...s, room: { ...room, ...next } })
    assert.equal(next.phase, 'realtalk')
    assert.equal(jumpTo(s, phase === 'transition' ? 'realtalk' : phase).phase, 'realtalk')
  }
})
test('skip and offline roster work for the two-game flow', () => {
  const players = makePlayers(12)
  const room = { ...makeRoom(players), phase: 'tierlist', phase_data: { roster: players.map((p) => p.id) } }
  const s = { room, players, onlineIds: [], now: 0 }
  assert.equal(skipGameStep(s).phase_data.next, 'realtalk')
  const talk = jumpTo(s, 'realtalk')
  assert.equal(talk.phase_data.roster.length, 12)
  assert.equal(skipGameStep({ ...s, room: { ...room, ...talk } }).phase, 'hangout')
  assert.equal(MAX_PLAYERS, 12)
})
console.log('Community planner')
test('chat invites accept HTTPS and reject executable URLs and embedded credentials', () => {
  assert.equal(inviteUrl(' https://example.com/invite '), 'https://example.com/invite')
  assert.equal(inviteUrl(''), '')
  for (const value of ['javascript:alert(1)', 'http://example.com', 'https://user:password@example.com']) assert.throws(() => inviteUrl(value))
})
test('calendar files preserve UTC, chosen duration and escaped text', () => {
  const plan = { activity: 'Snacks, games; together', location: 'Campus\nTable 2', starts_at: '2026-11-20T18:30:00-08:00', duration_minutes: 90 }
  const room = { id: 'room-id', title: 'Meetup' }
  const calendar = calendarForPlan(plan, room, 'https://example.com/room/TEST')
  assert.match(calendar, /DTSTART:20261121T023000Z/)
  assert.match(calendar, /DTEND:20261121T040000Z/)
  assert.ok(calendar.includes('SUMMARY:Snacks\\, games\\; together'))
  assert.ok(calendar.includes('LOCATION:Campus\\nTable 2'))
  assert.equal(calendarForPlan({ ...plan, starts_at: null }, room, ''), null)
})
console.log(`\n${passed} checks passed`)

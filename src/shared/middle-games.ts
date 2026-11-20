import catalog from './game-catalog.json' with { type: 'json' }
import { exploresCampus } from './experience.ts'
import { interestCounts } from './profile.ts'
import { habetTopic } from './habet.ts'
import type { GameCatalogEntry, MiddleChoice, PartyState, PlayerRow, RoomRow } from './types.ts'
export const GAME_CATALOG = catalog as GameCatalogEntry[]

export function selectMiddleGame(
  players: PlayerRow[],
  room: Pick<RoomRow, 'title' | 'description' | 'round'>,
): MiddleChoice {
  const interests = interestCounts(players)
  const ranks = GAME_CATALOG.filter((game) => players.length >= game.min_players)
    .map((game) => {
      const matches = players.filter((player) =>
        player.interests.some((interest) => game.interests.includes(interest)),
      ).length
      const shared = interests.find((item) => game.interests.includes(item.interest))
      const short = players.filter(
        (player) => player.this_or_that.games === 'b' || player.this_or_that.learning === 'b',
      ).length
      const cooperative = players.filter(
        (player) => player.this_or_that['group-activity'] === 'a' || player.this_or_that.learning === 'a',
      ).length
      let score = matches * 2
      if (game.id === 'habet') score += short * 2
      if (game.id === 'wavelength') score += players.length * 0.5 + cooperative * 2
      if (game.id === 'imposter')
        score = shared && shared.count >= Math.ceil(players.length * 0.6) ? score + shared.count * 2 : -1
      return { game, score, matches, shared }
    })
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
  const best = ranks[0] ?? { game: GAME_CATALOG[1], score: 0, matches: 0, shared: undefined }
  const ties = ranks.filter((entry) => entry.score === best.score)
  const chosen = ties.length ? ties[Math.max(0, room.round - 1) % ties.length] : best
  const topic = exploresCampus(room) ? 'Campus life' : (chosen.shared?.interest ?? 'Everyday things')
  return {
    id: chosen.game.id,
    name: chosen.game.name,
    topic,
    reason: chosen.shared
      ? `${chosen.shared.count} of ${players.length} picked ${chosen.shared.interest}. ${chosen.game.id === 'imposter' ? 'A shared topic for a guessing game.' : chosen.game.id === 'habet' ? 'A category for a fast round.' : 'A starting point for comparing opinions.'}`
      : 'A game everyone can join using everyday experience.',
  }
}
export function middleChoice(room: RoomRow, players: PlayerRow[]): MiddleChoice {
  const saved = room.phase_data.middle_game
  return saved && GAME_CATALOG.some((game) => game.id === saved.id) ? saved : selectMiddleGame(players, room)
}
export function middleSeed(room: Pick<RoomRow, 'id' | 'round'>): number {
  let value = Math.max(0, room.round - 1)
  for (const character of room.id) value = (Math.imul(value, 31) + character.charCodeAt(0)) >>> 0
  return value
}

const WORDS: Record<string, string[]> = {
  'Campus life': ['Library', 'Backpack', 'Whiteboard', 'Notebook', 'Bicycle'],
  Music: ['Headphones', 'Concert', 'Playlist', 'Guitar', 'Microphone'],
  Gaming: ['Controller', 'Chess', 'Arcade', 'Puzzle', 'Scoreboard'],
  Anime: ['Robot', 'Dragon', 'Hero', 'Castle', 'Adventure'],
  'Movies & TV': ['Popcorn', 'Cinema', 'Camera', 'Trailer', 'Superhero'],
  Tech: ['Keyboard', 'Robot', 'Browser', 'Laptop', 'Charger'],
  Books: ['Library', 'Bookmark', 'Novel', 'Bookshelf', 'Dictionary'],
  Food: ['Pizza', 'Picnic', 'Popcorn', 'Sandwich', 'Pancake'],
}
export function startParty(choice: MiddleChoice, roster: string[], seed: number, round = 0): PartyState {
  const positive = Math.max(0, seed)
  const words = WORDS[choice.topic] ?? ['Picnic', 'Bicycle', 'Umbrella', 'Suitcase', 'Backpack']
  return {
    kind: choice.id === 'imposter' ? 'imposter' : 'wavelength',
    stage: choice.id === 'imposter' ? 'describe' : 'clue',
    round,
    roster,
    turn: 0,
    clue_giver_id: roster[round % roster.length],
    target: 15 + ((positive * 23 + round * 37) % 71),
    left:
      choice.topic === 'Music'
        ? 'Quiet background'
        : choice.topic === 'Campus life'
          ? 'Quiet campus corner'
          : 'Quick and simple',
    right:
      choice.topic === 'Music'
        ? 'Full concert energy'
        : choice.topic === 'Campus life'
          ? 'Lively campus spot'
          : 'A whole adventure',
    clue: '',
    guess: 50,
    word: words[(positive + round) % words.length],
    imposter_id: roster[(positive + 1) % roster.length],
    score: 0,
  }
}
export function partyClue(game: PartyState, clue: string): PartyState {
  if (game.kind !== 'wavelength' || game.stage !== 'clue') throw new Error('The clue turn has changed.')
  const text = clue.trim().replace(/\s+/g, ' ')
  if (!text || text.length > 120) throw new Error('Enter a short clue, up to 120 characters.')
  return { ...game, clue: text, stage: 'guess' }
}
export function partyGuess(game: PartyState, guess: number): PartyState {
  if (game.kind !== 'wavelength' || game.stage !== 'guess') throw new Error('This guessing turn has changed.')
  if (!Number.isInteger(guess) || guess < 0 || guess > 100)
    throw new Error('Choose a position between 0 and 100.')
  const distance = Math.abs(game.target - guess)
  return {
    ...game,
    guess,
    stage: 'reveal',
    score: distance <= 5 ? 4 : distance <= 15 ? 3 : distance <= 25 ? 2 : 1,
  }
}
export function partyNextClue(game: PartyState): PartyState {
  if (game.kind !== 'imposter' || game.stage !== 'describe') throw new Error('This clue turn has changed.')
  const turn = game.turn + 1
  return { ...game, turn, stage: turn >= game.roster.length ? 'vote' : 'describe' }
}
export function partyVote(game: PartyState, suspect: string): PartyState {
  if (game.kind !== 'imposter' || game.stage !== 'vote' || !game.roster.includes(suspect))
    throw new Error('Choose one of the players after everyone has given a clue.')
  return { ...game, suspect_id: suspect, stage: 'reveal' }
}
export function privatePartyCard(game: PartyState, playerId: string): { title: string; body: string } | null {
  if (!game.roster.includes(playerId)) return null
  if (game.stage === 'reveal')
    return {
      title: 'Round revealed',
      body:
        game.kind === 'imposter'
          ? `The word was ${game.word}. Look up for the result.`
          : `The target was ${game.target}. Look up for the result.`,
    }
  if (game.kind === 'imposter')
    return playerId === game.imposter_id
      ? {
          title: 'You are the imposter',
          body: 'You did not get the word. Listen to the clues and give one word that could fit.',
        }
      : {
          title: 'Your shared word',
          body: `${game.word}. Give a one-word clue without saying the word itself.`,
        }
  return game.clue_giver_id === playerId && game.stage === 'clue'
    ? {
        title: `Your target is ${game.target} of 100`,
        body: `${game.left} (0) → ${game.right} (100). Say a clue that fits that position, without using numbers.`,
      }
    : {
        title: 'Look up at the group',
        body: 'Listen to the clue and discuss where it falls on the spectrum.',
      }
}
export function habetOrPartyTopic(choice: MiddleChoice, players: PlayerRow[], room: RoomRow) {
  return choice.id === 'habet' ? habetTopic(players, room) : choice.topic
}

import type { AvatarColor } from './types.ts'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6
export const MIN_INTERESTS = 3
export const MAX_INTERESTS = 5
export const WIT_MAX_CHARS = 60
export const WIT_SECONDS = 45
export const QUICK_PLAY_PROMPTS = 2

export const AVATARS: AvatarColor[] = ['yellow', 'pink', 'cyan', 'green', 'orange', 'lilac']

export const INTERESTS = [
  'Food',
  'Music',
  'Gaming',
  'Anime',
  'Sports',
  'Outdoors',
  'Movies & TV',
  'Fashion',
  'Art & design',
  'Tech',
  'Travel',
  'Fitness',
  'Pets',
  'Books',
  'Cooking',
  'Going out',
]

export const VOICE_QUESTION = "What's something you've been really into lately, and why?"

export interface ThisOrThat {
  key: string
  a: { label: string; group: string }
  b: { label: string; group: string }
}

/** `group` finishes the sentence "4 of you ..." on the common ground screen. */
export const THIS_OR_THAT: ThisOrThat[] = [
  {
    key: 'sleep',
    a: { label: 'Early bird', group: 'are early birds' },
    b: { label: 'Night owl', group: 'are night owls' },
  },
  {
    key: 'social',
    a: { label: 'Stay in', group: 'would rather stay in' },
    b: { label: 'Go out', group: 'would rather go out' },
  },
  {
    key: 'taste',
    a: { label: 'Sweet', group: 'pick sweet over savory' },
    b: { label: 'Savory', group: 'pick savory over sweet' },
  },
  {
    key: 'place',
    a: { label: 'Beach', group: 'are beach people' },
    b: { label: 'Mountains', group: 'are mountain people' },
  },
  {
    key: 'plan',
    a: { label: 'Plan it', group: 'like to plan it' },
    b: { label: 'Wing it', group: 'like to wing it' },
  },
]

export interface VoiceQuestion {
  id: string
  category: 'everyday' | 'story' | 'hypothetical'
  prompt: string
}

export const VOICE_QUESTIONS: VoiceQuestion[] = [
  { id: 'into-lately', category: 'everyday', prompt: "What's something you've been really into lately, and why?" },
  { id: 'favorite-version', category: 'everyday', prompt: 'What do you know well enough to have a favorite version of it? What makes that version good?' },
  { id: 'ordinary-task', category: 'everyday', prompt: "What's an ordinary task you've found a satisfying way to do?" },
  { id: 'one-song', category: 'everyday', prompt: 'You get control of the speaker for one song. What do you play, and when?' },
  { id: 'free-hour', category: 'everyday', prompt: 'You have an unexpected free hour on campus. How would you spend it?' },
  { id: 'recommendation', category: 'everyday', prompt: "What's something you could recommend to a beginner? What makes it a good starting point?" },
  { id: 'tried-recommendation', category: 'story', prompt: "What's something you tried because someone recommended it? How did it go?" },
  { id: 'changed-plan', category: 'story', prompt: 'When did a plan change at the last minute and turn out better?' },
  { id: 'figured-out', category: 'story', prompt: "What's something you made, fixed, or figured out that you wanted to show someone?" },
  { id: 'beginner', category: 'story', prompt: 'Tell us about a time you enjoyed being a beginner at something.' },
  { id: 'small-discovery', category: 'story', prompt: "What's a small discovery that made an ordinary day more interesting?" },
  { id: 'group-rule', category: 'story', prompt: "What's a rule your group invented that made an activity better?" },
  { id: 'teach-class', category: 'hypothetical', prompt: 'If you had to teach a class on anything, what would it be, and what would people try first?' },
  { id: 'free-trip', category: 'hypothetical', prompt: 'If you won a free trip tomorrow, where would you go and what would you do?' },
  { id: 'fictional-world', category: 'hypothetical', prompt: 'If you could visit any fictional world, which one would you choose, and what would you do there?' },
  { id: 'master-skill', category: 'hypothetical', prompt: 'If you could instantly master one skill, what would it be, and why?' },
  { id: 'campus-fair', category: 'hypothetical', prompt: 'You get one table at a campus fair. What would you let people try?' },
  { id: 'campus-room', category: 'hypothetical', prompt: 'You can add one room to campus that anyone can use. What goes in it?' },
]

// Examples for the generator and a larger general pool for the offline game.
export const REAL_TALK_QUESTIONS = {
  light: [
    'What snack would you nominate for a group taste test?',
    'What everyday sound would make a great game-show buzzer?',
    'What could you happily spend ten minutes browsing?',
    'What tiny contest would you enter just for fun?',
    'What ordinary object would your zombie-apocalypse team argue is essential?',
    'What would you put in a campus time capsule?',
    'What is a small thing you look forward to during the week?',
    'What would you name a club that only meets for ten minutes?',
    'What is your favorite way to spend an unexpected free hour?',
  ],
  real: [
    'What do you enjoy more after someone showed you how to get started?',
    'When did someone change your mind about a food, game, or hobby?',
    'What rule did a group invent that made an activity better?',
    'When have you enjoyed being a beginner?',
    'What did you try on a recommendation, and how did it go?',
    'When did a changed plan turn into a good afternoon?',
    'What have you figured out that you wanted to show someone?',
    'When did you discover an interest you did not expect to enjoy?',
    'What is something you would enjoy learning around a table with other people?',
  ],
  deep: [
    'What does someone do that makes it easier for you to join a conversation?',
    'What makes an ordinary afternoon feel like time well spent?',
    'When people disagree, what makes you curious enough to keep listening?',
    'What would you hope a new person remembers about spending time with you?',
    'What makes you want to keep practicing something after the first attempt?',
    'What helps a group make room for a quieter person?',
    'What kind of curiosity would you like to make more time for?',
    'What makes you feel that your contribution to a group matters?',
    'What is something you appreciate more now than you used to?',
  ],
}

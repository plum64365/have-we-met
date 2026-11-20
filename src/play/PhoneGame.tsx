import { IconEyes, IconPencil, IconSpark } from '../components/ui.tsx'
import type { RoomState } from '../hooks/useRoom.ts'
import type { PlayerRow, RoomRow } from '../shared/types.ts'
import { RoomCommunity } from '../components/RoomCommunity.tsx'
import { PartyCard } from './PartyCard.tsx'
import { Message } from './Message.tsx'

interface Props {
  state: RoomState
  room: RoomRow
  player: PlayerRow
}

export function PhoneGame({ state, room, player }: Props) {
  switch (room.phase) {
    case 'building':
      return <Message icon={<IconSpark size={72} />} title="Building your game…" body="Look up at the big screen." />
    case 'common_ground':
      return <Message icon={<IconEyes size={72} />} title="Look up!" body="See what you all have in common." />
    case 'tierlist':
      if (room.phase_data.scribeId === player.id) {
        return <Message icon={<IconPencil size={72} />} title="You're the scribe!" body="Head to the laptop. The group debates, you tap the tier." />
      }
      return <PhonesAway />
    case 'wit_answer':
      if (room.phase_data.party) return <PartyCard key={`${room.round}:${room.phase_data.party.kind}:${room.phase_data.party.round}`} game={room.phase_data.party} playerId={player.id} />
      if (room.phase_data.habet) return <Message icon={<IconEyes size={72} />} title="Habet · Look up!" body="Take turns saying an answer with an unused first letter. The host enters it on the shared screen." />
      return <PhonesAway />
    case 'hangout':
      return <RoomCommunity room={room} players={state.players} player={player} />
    default:
      return <PhonesAway />
  }
}

function PhonesAway() {
  return <Message icon={<IconEyes size={84} />} title="Phones away!" body="Look up. This one happens out loud." />
}

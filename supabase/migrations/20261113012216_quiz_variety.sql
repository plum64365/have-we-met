-- Multiple question/answer pairs, with the original voice_text retained for old games.
alter table public.players
  add column voice_answers jsonb not null default '[]'::jsonb,
  add column quiz_round integer not null default 1;

update public.players p set quiz_round = r.round
from public.rooms r where r.id = p.room_id;

create function public.valid_voice_answers(answers jsonb)
returns boolean language sql immutable set search_path = ''
as $$
  select case
    when jsonb_typeof(answers) <> 'array' then false
    when jsonb_array_length(answers) > 3 then false
    else coalesce((
      select bool_and(
        jsonb_typeof(a) = 'object'
        and jsonb_typeof(a->'question_id') = 'string'
        and char_length(a->>'question_id') between 1 and 64
        and jsonb_typeof(a->'question') = 'string'
        and char_length(a->>'question') between 1 and 200
        and jsonb_typeof(a->'answer') = 'string'
        and char_length(a->>'answer') <= 400
        and a ?& array['question_id', 'question', 'answer']
      ) from jsonb_array_elements(answers) a
    ), true)
  end;
$$;

alter table public.players add constraint players_voice_answers_valid
  check (public.valid_voice_answers(voice_answers));

create function public.prepare_player_quiz()
returns trigger language plpgsql set search_path = ''
as $$
begin
  select round into new.quiz_round from public.rooms where id = new.room_id;
  return new;
end;
$$;

create trigger players_prepare_quiz before insert on public.players
for each row execute function public.prepare_player_quiz();

-- Reset the whole table's quiz in the same transaction as Play Again.
-- Interests are reusable; question answers and completion belong to one round.
create function public.reset_round_quizzes()
returns trigger language plpgsql set search_path = ''
as $$
begin
  update public.players set quiz_round = new.round, quiz_done = false,
    voice_text = null, voice_answers = '[]'::jsonb, this_or_that = '{}'::jsonb
  where room_id = new.id;
  return new;
end;
$$;

create trigger rooms_reset_quizzes after update of round on public.rooms
for each row when (old.round is distinct from new.round)
execute function public.reset_round_quizzes();

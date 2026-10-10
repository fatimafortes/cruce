-- Cruce F5: at most 5 attempts per worker per calendar day (Monterrey time).
--
-- Shared semester Supabase project: creates only cruce_* objects, never drops
-- anything, one transaction. Run once in Supabase → SQL Editor, after
-- 20261010150000_cruce_schema.sql.
--
-- Enforced in the database, not only in the API route: workers could insert
-- attempts through Supabase's API directly with the public key. The count
-- survives deleting attempts (owner's decision), so delete-and-recreate can't
-- get around it. It stores only a number per worker per day, no text.
-- Gemini runs once per answered attempt, so this also caps Gemini calls.

begin;

create table public.cruce_daily_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  attempts integer not null default 0 check (attempts >= 0),
  primary key (user_id, day)
);

-- No API access at all: no grants and no policies for anon/authenticated.
revoke all on table public.cruce_daily_usage from anon, authenticated;
grant all on table public.cruce_daily_usage to service_role;
alter table public.cruce_daily_usage enable row level security;

create function public.cruce_daily_attempt_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

create function public.cruce_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Monterrey')::date $$;

-- Counts the attempt before it is inserted and rejects the one over the limit.
-- If the insert fails for any reason (limit, RLS, length check), the whole
-- statement rolls back, including this increment.
create function public.cruce_count_attempt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  insert into public.cruce_daily_usage as u (user_id, day, attempts)
  values (new.user_id, public.cruce_today(), 1)
  on conflict (user_id, day) do update set attempts = u.attempts + 1
  returning u.attempts into used;

  if used > public.cruce_daily_attempt_limit() then
    raise exception 'cruce_daily_limit'
      using hint = 'Max attempts per day reached for this worker.';
  end if;
  return new;
end;
$$;

create trigger cruce_attempts_daily_limit
  before insert on public.cruce_attempts
  for each row execute function public.cruce_count_attempt();

-- How many attempts the signed-in Google worker has left today (0 for anyone else).
create function public.cruce_attempts_left_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.cruce_is_google_user() then 0
    else greatest(
      0,
      public.cruce_daily_attempt_limit() - coalesce((
        select u.attempts from public.cruce_daily_usage u
        where u.user_id = auth.uid() and u.day = public.cruce_today()
      ), 0)
    )
  end
$$;

revoke execute on function
  public.cruce_daily_attempt_limit(),
  public.cruce_today(),
  public.cruce_count_attempt(),
  public.cruce_attempts_left_today()
from public, anon;

grant execute on function public.cruce_attempts_left_today() to authenticated, service_role;

commit;

-- Cruce F7: what a shared proof link shows.
--
-- Shared semester Supabase project: changes only cruce_* objects, never drops
-- anything, one transaction. Run once in Supabase → SQL Editor, after the
-- F3 and F5 migrations.
--
-- The worker decides what a link shows (C2), and it never becomes a gate (C1):
--   * always: the four states and the date;
--   * if typed: a display name (max 60 characters), stored with the link, so
--     revoking the link removes it from public view;
--   * only if ticked ("Incluir mis respuestas", off by default): her two answers;
--   * never: the AI suggestion, the reviewer's note, a user id or an email.
-- Public reads go only through cruce_proof_by_token(); anon still has no
-- access to any cruce_ table.

begin;

alter table public.cruce_proof_links
  add column display_name text
    check (display_name is null or char_length(display_name) between 1 and 60),
  add column include_answers boolean not null default false;

-- The worker chooses these when creating the link; afterwards only `revoked`
-- can change (F3 grant). To change them, revoke and create a new link.
grant insert (attempt_id, display_name, include_answers)
  on public.cruce_proof_links to authenticated;

-- One row for a live link, no rows for a revoked or unknown token: the public
-- page can't tell the two apart, so nobody can probe which tokens exist.
create function public.cruce_proof_by_token(p_token text)
returns table (
  submitted_at     timestamptz,
  has_answer       boolean,
  numbers_ok       boolean,   -- null when the automatic checks are unavailable
  review_explained boolean,   -- null until a person decides
  display_name     text,
  include_answers  boolean,
  email_answer     text,      -- null unless include_answers
  followup_answer  text       -- null unless include_answers
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.created_at,
    true,
    case
      when a.rule_checks is null then null
      else not (
        jsonb_path_exists(a.rule_checks, '$.task1[*] ? (@.passed == false)')
        or jsonb_path_exists(a.rule_checks, '$.task2[*] ? (@.passed == false)')
      )
    end,
    r.explained,
    l.display_name,
    l.include_answers,
    case when l.include_answers then a.email_answer end,
    case when l.include_answers then a.followup_answer end
  from public.cruce_proof_links l
  join public.cruce_attempts a on a.id = l.attempt_id
  left join public.cruce_reviews r on r.attempt_id = a.id
  where p_token ~ '^[0-9a-f]{64}$'
    and l.token = p_token
    and l.revoked = false
$$;

revoke execute on function public.cruce_proof_by_token(text) from public;
grant execute on function public.cruce_proof_by_token(text) to anon, authenticated, service_role;

commit;

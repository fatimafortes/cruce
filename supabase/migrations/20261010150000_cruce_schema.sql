-- Cruce F3: schema with Row Level Security.
--
-- Shared semester Supabase project: this migration only CREATES objects whose
-- names start with cruce_ (tables, functions, policies, triggers). It never
-- drops or alters anything else. It runs as one transaction: if any statement
-- fails, nothing is applied. Run it once in Supabase → SQL Editor.
--
-- Who can do what (security floor 2 and 3; packet §9 and §10):
--   * Only Google sign-ins count. Anonymous and email-only users of the shared
--     project get nothing (cruce_is_google_user()).
--   * Workers read, create and delete their own attempts. They can write only
--     their two answers; rule_checks and ai_suggestion are written by server
--     code with Cruce's own secret key (service_role), so a worker can't forge them.
--   * Reviewers never read cruce_attempts directly. They use
--     cruce_review_queue(), which returns no user id, name or email (C3).
--   * Proof links: owner creates and revokes; public reads go through a
--     token lookup function added in F7, never the table.
--   * Gate snapshots: public read; only reviewers insert.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True only for a signed-in, non-anonymous user whose account has a Google identity.
create function public.cruce_is_google_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and coalesce((auth.jwt() -> 'app_metadata' -> 'providers') ? 'google', false)
$$;

create function public.cruce_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.cruce_reviewers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- (Defined after cruce_reviewers: SQL function bodies are checked at creation.)
-- True when the current Google user is listed in cruce_reviewers.
create function public.cruce_is_reviewer()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.cruce_is_google_user()
     and exists (
       select 1 from public.cruce_reviewers r where r.user_id = auth.uid()
     )
$$;

create table public.cruce_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email_answer    text not null
                  check (char_length(email_answer) between 80 and 3000),
  followup_answer text
                  check (followup_answer is null or char_length(followup_answer) between 40 and 1500),
  rule_checks     jsonb,
  ai_suggestion   text
                  check (ai_suggestion is null or char_length(ai_suggestion) <= 4000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index cruce_attempts_user_created_idx
  on public.cruce_attempts (user_id, created_at desc);

create trigger cruce_attempts_set_updated_at
  before update on public.cruce_attempts
  for each row execute function public.cruce_set_updated_at();

create table public.cruce_reviews (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null unique references public.cruce_attempts (id) on delete cascade,
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  explained   boolean not null,
  note        text not null default ''
              check (char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger cruce_reviews_set_updated_at
  before update on public.cruce_reviews
  for each row execute function public.cruce_set_updated_at();

create table public.cruce_proof_links (
  id         uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cruce_attempts (id) on delete cascade,
  -- 64 hex characters from two random UUIDs (~244 random bits); no extension needed.
  token      text not null unique
             default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
             check (char_length(token) >= 32),
  revoked    boolean not null default false,
  created_at timestamptz not null default now()
);

create index cruce_proof_links_attempt_idx
  on public.cruce_proof_links (attempt_id);

create table public.cruce_gate_snapshots (
  id             uuid primary key default gen_random_uuid(),
  snapshot_date  date not null,
  source         text not null check (char_length(source) between 1 and 200),
  query          text not null check (char_length(query) between 1 and 500),
  total_count    integer not null check (total_count >= 0),
  plant_cs_count integer not null check (plant_cs_count >= 0),
  notes          text check (notes is null or char_length(notes) <= 2000),
  created_at     timestamptz not null default now(),
  check (plant_cs_count <= total_count)
);

-- ---------------------------------------------------------------------------
-- Privileges: Supabase grants every new table to anon and authenticated by
-- default. Take that back, then grant only what each role needs.
-- ---------------------------------------------------------------------------

revoke all on table
  public.cruce_reviewers,
  public.cruce_attempts,
  public.cruce_reviews,
  public.cruce_proof_links,
  public.cruce_gate_snapshots
from anon, authenticated;

grant all on table
  public.cruce_reviewers,
  public.cruce_attempts,
  public.cruce_reviews,
  public.cruce_proof_links,
  public.cruce_gate_snapshots
to service_role;

-- Reviewers list: read your own row only (policy below). Managed in the SQL Editor.
grant select on public.cruce_reviewers to authenticated;

-- Attempts: workers write only their answers. rule_checks and ai_suggestion
-- are written by the server with the service_role key.
grant select, delete on public.cruce_attempts to authenticated;
grant insert (email_answer) on public.cruce_attempts to authenticated;
grant update (followup_answer) on public.cruce_attempts to authenticated;

-- Reviews: reviewers write the decision and the note.
grant select on public.cruce_reviews to authenticated;
grant insert (attempt_id, explained, note) on public.cruce_reviews to authenticated;
grant update (explained, note) on public.cruce_reviews to authenticated;

-- Proof links: create for an attempt, then only revoke.
grant select on public.cruce_proof_links to authenticated;
grant insert (attempt_id) on public.cruce_proof_links to authenticated;
grant update (revoked) on public.cruce_proof_links to authenticated;

-- Gate snapshots: everyone reads; reviewers insert (policy below).
grant select on public.cruce_gate_snapshots to anon, authenticated;
grant insert (snapshot_date, source, query, total_count, plant_cs_count, notes)
  on public.cruce_gate_snapshots to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.cruce_reviewers      enable row level security;
alter table public.cruce_attempts       enable row level security;
alter table public.cruce_reviews        enable row level security;
alter table public.cruce_proof_links    enable row level security;
alter table public.cruce_gate_snapshots enable row level security;

-- cruce_reviewers
create policy cruce_reviewers_select_own on public.cruce_reviewers
  for select to authenticated
  using (public.cruce_is_google_user() and user_id = auth.uid());

-- cruce_attempts: the owner only. Reviewers use cruce_review_queue().
create policy cruce_attempts_select_own on public.cruce_attempts
  for select to authenticated
  using (public.cruce_is_google_user() and user_id = auth.uid());

create policy cruce_attempts_insert_own on public.cruce_attempts
  for insert to authenticated
  with check (public.cruce_is_google_user() and user_id = auth.uid());

-- The follow-up can be written once; after that the attempt is locked.
create policy cruce_attempts_update_own_followup on public.cruce_attempts
  for update to authenticated
  using (public.cruce_is_google_user() and user_id = auth.uid() and followup_answer is null)
  with check (public.cruce_is_google_user() and user_id = auth.uid());

-- C2: the proof belongs to the worker, who may delete it (reviews and links cascade).
create policy cruce_attempts_delete_own on public.cruce_attempts
  for delete to authenticated
  using (public.cruce_is_google_user() and user_id = auth.uid());

-- cruce_reviews
create policy cruce_reviews_select on public.cruce_reviews
  for select to authenticated
  using (
    public.cruce_is_reviewer()
    or (
      public.cruce_is_google_user()
      and exists (
        select 1 from public.cruce_attempts a
        where a.id = attempt_id and a.user_id = auth.uid()
      )
    )
  );

-- Reviewers can't review their own attempts.
create policy cruce_reviews_insert_reviewer on public.cruce_reviews
  for insert to authenticated
  with check (
    public.cruce_is_reviewer()
    and reviewer_id = auth.uid()
    and not exists (
      select 1 from public.cruce_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  );

create policy cruce_reviews_update_own_review on public.cruce_reviews
  for update to authenticated
  using (public.cruce_is_reviewer() and reviewer_id = auth.uid())
  with check (public.cruce_is_reviewer() and reviewer_id = auth.uid());

-- cruce_proof_links: only for attempts you own.
create policy cruce_proof_links_select_own on public.cruce_proof_links
  for select to authenticated
  using (
    public.cruce_is_google_user()
    and exists (
      select 1 from public.cruce_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  );

create policy cruce_proof_links_insert_own on public.cruce_proof_links
  for insert to authenticated
  with check (
    public.cruce_is_google_user()
    and exists (
      select 1 from public.cruce_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  );

-- Revoking is one-way: only a live link can be updated, and only to revoked.
create policy cruce_proof_links_revoke_own on public.cruce_proof_links
  for update to authenticated
  using (
    public.cruce_is_google_user()
    and revoked = false
    and exists (
      select 1 from public.cruce_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  )
  with check (revoked = true);

-- cruce_gate_snapshots: aggregate numbers only, public read.
create policy cruce_gate_snapshots_select_all on public.cruce_gate_snapshots
  for select to anon, authenticated
  using (true);

create policy cruce_gate_snapshots_insert_reviewer on public.cruce_gate_snapshots
  for insert to authenticated
  with check (public.cruce_is_reviewer());

-- ---------------------------------------------------------------------------
-- Reviewer queue: attempts without who wrote them (C3, packet swimlane "no name shown").
-- security definer so it can read all attempts; it returns rows only to reviewers
-- and never includes user_id. A reviewer's own attempts are left out.
-- ---------------------------------------------------------------------------

create function public.cruce_review_queue()
returns table (
  attempt_id       uuid,
  email_answer     text,
  followup_answer  text,
  rule_checks      jsonb,
  ai_suggestion    text,
  submitted_at     timestamptz,
  review_explained boolean,
  review_note      text,
  reviewed_at      timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.email_answer, a.followup_answer, a.rule_checks, a.ai_suggestion,
         a.created_at, r.explained, r.note, r.updated_at
  from public.cruce_attempts a
  left join public.cruce_reviews r on r.attempt_id = a.id
  where public.cruce_is_reviewer()
    and a.user_id <> auth.uid()
  order by a.created_at
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: Supabase grants new functions to anon by default.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.cruce_is_google_user(),
  public.cruce_is_reviewer(),
  public.cruce_set_updated_at(),
  public.cruce_review_queue()
from public, anon;

grant execute on function
  public.cruce_is_google_user(),
  public.cruce_is_reviewer(),
  public.cruce_review_queue()
to authenticated, service_role;

commit;

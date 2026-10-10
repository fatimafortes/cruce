-- Cruce F3: RLS test. Run in Supabase → SQL Editor AFTER the migration.
--
-- NOTHING IS SAVED. The whole test is one DO block that ends by raising an
-- error on purpose. The error carries the PASS/FAIL report, and it makes
-- Postgres undo every change in this run: the temporary test users, their
-- attempts, reviews, links and snapshots.
--
-- Expect a red error box that starts with "CRUCE RLS TEST". Copy its full text.
--
-- The test creates five temporary users in auth.users (needed for the foreign
-- keys): worker A, worker B, reviewer R (all Google), anonymous user C and
-- email-only user D. If another week's app has a trigger on auth.users, it
-- fires too, and is undone with everything else.
-- Then it acts as each user (role + JWT claims, the way Supabase's API does)
-- and checks what RLS allows.

do $test$
declare
  a uuid := gen_random_uuid();   -- worker A (Google)
  b uuid := gen_random_uuid();   -- worker B (Google)
  r uuid := gen_random_uuid();   -- reviewer R (Google)
  c uuid := gen_random_uuid();   -- anonymous user C
  d uuid := gen_random_uuid();   -- email-only user D
  google jsonb := '{"provider":"google","providers":["google"]}';
  att_a uuid; att_b uuid; att_r uuid; link_a uuid;
  n int; ok boolean; err text; tok text;
  results text[] := '{}';
  fails int := 0;
  long_email text := repeat('Hi Sarah, PO-48213 BRK-2207-A: 800 shipped, 400 pending, new date Nov 14. ', 2);
  long_followup text := repeat('250 ship Nov 14, 150 ship Nov 19; air freight needs approval. ', 1);
begin
  -- Setup (as the SQL Editor's admin role) -------------------------------
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, is_anonymous, created_at, updated_at)
  values
    (a, 'authenticated', 'authenticated', 'cruce-rls-a@example.invalid', google, '{}', false, now(), now()),
    (b, 'authenticated', 'authenticated', 'cruce-rls-b@example.invalid', google, '{}', false, now(), now()),
    (r, 'authenticated', 'authenticated', 'cruce-rls-r@example.invalid', google, '{}', false, now(), now()),
    (c, 'authenticated', 'authenticated', null, '{}', '{}', true, now(), now()),
    (d, 'authenticated', 'authenticated', 'cruce-rls-d@example.invalid', '{"provider":"email","providers":["email"]}', '{}', false, now(), now());
  insert into public.cruce_reviewers (user_id) values (r);

  -- ===== Worker A =========================================================
  perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', google)::text, true);
  execute 'set local role authenticated';

  begin
    insert into public.cruce_attempts (email_answer) values (long_email) returning id into att_a;
    ok := att_a is not null; err := null;
  exception when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 01 A creates own attempt %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  begin
    insert into public.cruce_attempts (email_answer, rule_checks) values (long_email, '{"all":"passed"}');
    ok := false; err := 'insert succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 02 A cannot insert rule_checks %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  begin
    update public.cruce_attempts set ai_suggestion = 'perfect' where id = att_a;
    ok := false; err := 'update succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 03 A cannot write ai_suggestion %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  begin
    update public.cruce_attempts set followup_answer = long_followup where id = att_a;
    get diagnostics n = row_count; ok := n = 1; err := format('rows=%s', n);
  exception when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 04 A writes own follow-up once (%s)', case when ok then 'PASS' else 'FAIL' end, err);
  if not ok then fails := fails + 1; end if;

  begin
    update public.cruce_attempts set followup_answer = long_followup || ' edited' where id = att_a;
    get diagnostics n = row_count; ok := n = 0; err := format('rows=%s', n);
  exception when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 05 A cannot change follow-up after it is written (%s)', case when ok then 'PASS' else 'FAIL' end, err);
  if not ok then fails := fails + 1; end if;

  begin
    insert into public.cruce_reviewers (user_id) values (a);
    ok := false; err := 'insert succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 06 A cannot add self as reviewer %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  begin
    insert into public.cruce_gate_snapshots (snapshot_date, source, query, total_count, plant_cs_count)
    values (current_date, 'test', 'test', 10, 2);
    ok := false; err := 'insert succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 07 A (not reviewer) cannot add gate snapshot %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  select count(*) into n from public.cruce_review_queue();
  ok := n = 0;
  results := results || format('%s 08 A (not reviewer) gets empty review queue (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  -- ===== Worker B =========================================================
  perform set_config('request.jwt.claims', jsonb_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', google)::text, true);

  begin
    insert into public.cruce_attempts (email_answer) values (long_email) returning id into att_b;
    ok := att_b is not null; err := null;
  exception when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 09 B creates own attempt %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  select count(*) into n from public.cruce_attempts where id = att_a;
  ok := n = 0;
  results := results || format('%s 10 B cannot read A''s attempt by id (rows=%s)  <-- F3 acceptance test', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  select count(*) into n from public.cruce_attempts;
  ok := n = 1;
  results := results || format('%s 11 B sees only own attempts (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  update public.cruce_attempts set followup_answer = long_followup where id = att_a;
  get diagnostics n = row_count; ok := n = 0;
  results := results || format('%s 12 B cannot update A''s attempt (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  delete from public.cruce_attempts where id = att_a;
  get diagnostics n = row_count; ok := n = 0;
  results := results || format('%s 13 B cannot delete A''s attempt (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  begin
    insert into public.cruce_reviews (attempt_id, explained, note) values (att_a, true, 'x');
    ok := false; err := 'insert succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 14 B (not reviewer) cannot review A''s attempt %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  begin
    insert into public.cruce_proof_links (attempt_id) values (att_a);
    ok := false; err := 'insert succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 15 B cannot create a share link for A''s attempt %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  -- ===== Anonymous user C and email-only user D ===========================
  perform set_config('request.jwt.claims', jsonb_build_object('sub', c, 'role', 'authenticated', 'is_anonymous', true, 'app_metadata', '{}'::jsonb)::text, true);
  begin
    insert into public.cruce_attempts (email_answer) values (long_email);
    ok := false; err := 'insert succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 16 anonymous user cannot create an attempt %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', d, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', '{"provider":"email","providers":["email"]}'::jsonb)::text, true);
  begin
    insert into public.cruce_attempts (email_answer) values (long_email);
    ok := false; err := 'insert succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 17 email-only user cannot create an attempt %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  -- ===== Signed-out visitor (anon role, no user) ===========================
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';

  begin
    select count(*) into n from public.cruce_attempts;
    ok := false; err := format('read %s rows', n);
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 18 signed-out visitor cannot read attempts %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  begin
    select count(*) into n from public.cruce_gate_snapshots;
    ok := true; err := null;
  exception when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 19 signed-out visitor can read gate snapshots %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  begin
    perform public.cruce_review_queue();
    ok := false; err := 'call succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 20 signed-out visitor cannot call the review queue %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  -- ===== Reviewer R ========================================================
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', jsonb_build_object('sub', r, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', google)::text, true);

  insert into public.cruce_attempts (email_answer) values (long_email) returning id into att_r;

  select count(*) into n from public.cruce_attempts where id in (att_a, att_b);
  ok := n = 0;
  results := results || format('%s 21 R cannot read workers'' attempts directly (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  select count(*) into n from public.cruce_review_queue() q where q.attempt_id in (att_a, att_b);
  ok := n = 2;
  results := results || format('%s 22 R sees A''s and B''s attempts in the review queue (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  select count(*) into n from public.cruce_review_queue() q where q.attempt_id = att_r;
  ok := n = 0;
  results := results || format('%s 23 R''s own attempt is not in the review queue (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  select count(*) into n
  from information_schema.routines rt
  join information_schema.parameters p on p.specific_name = rt.specific_name
  where rt.routine_schema = 'public' and rt.routine_name = 'cruce_review_queue'
    and p.parameter_mode = 'OUT' and p.parameter_name in ('user_id', 'email', 'name');
  ok := n = 0;
  results := results || format('%s 24 review queue has no user_id/email/name column (found=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  begin
    insert into public.cruce_reviews (attempt_id, explained, note) values (att_a, true, 'Explicó el cambio con claridad.');
    ok := true; err := null;
  exception when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 25 R reviews A''s attempt %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  begin
    insert into public.cruce_reviews (attempt_id, explained, note) values (att_r, true, 'self');
    ok := false; err := 'insert succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 26 R cannot review own attempt %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  begin
    insert into public.cruce_gate_snapshots (snapshot_date, source, query, total_count, plant_cs_count, notes)
    values (current_date, 'test source', 'customer service planta Monterrey', 40, 6, 'test');
    ok := true; err := null;
  exception when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 27 R adds a gate snapshot %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  select count(*) into n from public.cruce_reviewers;
  ok := n = 1;
  results := results || format('%s 28 R sees only own row in cruce_reviewers (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  -- ===== Back to A: reviews and proof links ===============================
  perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', google)::text, true);

  select count(*) into n from public.cruce_reviews where attempt_id = att_a;
  ok := n = 1;
  results := results || format('%s 29 A reads the review of own attempt (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  begin
    insert into public.cruce_proof_links (attempt_id) values (att_a) returning id, token into link_a, tok;
    ok := link_a is not null and char_length(tok) >= 32; err := format('token length %s', char_length(tok));
  exception when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 30 A creates a share link (%s)', case when ok then 'PASS' else 'FAIL' end, err);
  if not ok then fails := fails + 1; end if;

  update public.cruce_proof_links set revoked = true where id = link_a;
  get diagnostics n = row_count; ok := n = 1;
  results := results || format('%s 31 A revokes the link (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  update public.cruce_proof_links set revoked = false where id = link_a;
  get diagnostics n = row_count; ok := n = 0;
  results := results || format('%s 32 A cannot un-revoke the link (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  -- ===== B again: A's review and link stay hidden =========================
  perform set_config('request.jwt.claims', jsonb_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', google)::text, true);

  select count(*) into n from public.cruce_reviews where attempt_id = att_a;
  ok := n = 0;
  results := results || format('%s 33 B cannot read A''s review (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  select count(*) into n from public.cruce_proof_links where attempt_id = att_a;
  ok := n = 0;
  results := results || format('%s 34 B cannot read A''s share links (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  -- ===== A deletes own attempt (C2) =======================================
  perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', google)::text, true);

  delete from public.cruce_attempts where id = att_a;
  get diagnostics n = row_count; ok := n = 1;
  results := results || format('%s 35 A deletes own attempt (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  execute 'reset role';
  select count(*) into n from public.cruce_reviews where attempt_id = att_a;
  select n + count(*) into n from public.cruce_proof_links where attempt_id = att_a;
  ok := n = 0;
  results := results || format('%s 36 deleting the attempt also removed its review and links (left=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  -- Report and undo everything ---------------------------------------------
  raise exception using
    message = format(
      E'CRUCE RLS TEST: %s — %s of %s passed. All changes rolled back; nothing was saved.\n%s',
      case when fails = 0 then 'ALL PASS' else fails || ' FAILED' end,
      array_length(results, 1) - fails,
      array_length(results, 1),
      array_to_string(results, E'\n')
    );
end
$test$;

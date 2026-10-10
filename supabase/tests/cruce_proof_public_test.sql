-- Cruce F7: share-link test. Run in Supabase → SQL Editor AFTER all three migrations.
--
-- NOTHING IS SAVED: one DO block that ends by raising an error on purpose; the
-- error carries the PASS/FAIL report and undoes every change.
-- Expect a red error box that starts with "CRUCE PROOF LINK TEST".

do $test$
declare
  a uuid := gen_random_uuid();   -- worker A (Google)
  b uuid := gen_random_uuid();   -- worker B (Google)
  r uuid := gen_random_uuid();   -- reviewer R
  google jsonb := '{"provider":"google","providers":["google"]}';
  email text := repeat('Hi Sarah, PO-48213 BRK-2207-A: 800 shipped, 400 pending, new date Nov 14. ', 2);
  followup text := 'Line 3 restarted: 250 ship Nov 14, 150 ship Nov 19; air freight needs approval.';
  att uuid; att_flagged uuid;
  tok_plain text; tok_full text; tok_flagged text;
  link_plain uuid;
  rec record;
  n int; ok boolean; err text;
  results text[] := '{}';
  fails int := 0;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, is_anonymous, created_at, updated_at)
  values
    (a, 'authenticated', 'authenticated', 'cruce-proof-a@example.invalid', google, '{}', false, now(), now()),
    (b, 'authenticated', 'authenticated', 'cruce-proof-b@example.invalid', google, '{}', false, now(), now()),
    (r, 'authenticated', 'authenticated', 'cruce-proof-r@example.invalid', google, '{}', false, now(), now());
  insert into public.cruce_reviewers (user_id) values (r);

  -- Two attempts for A (as admin, like the server would): one all-passed and reviewed, one with a flagged number.
  insert into public.cruce_attempts (user_id, email_answer, followup_answer, rule_checks, ai_suggestion)
  values (a, email, followup,
          '{"version":1,"task1":[{"item":"x","passed":true,"detail":"d"}],"task2":[{"item":"y","passed":true,"detail":"d"}]}',
          'SECRET-AI-TEXT')
  returning id into att;
  insert into public.cruce_reviews (attempt_id, reviewer_id, explained, note) values (att, r, true, 'SECRET-REVIEW-NOTE');
  insert into public.cruce_attempts (user_id, email_answer, rule_checks)
  values (a, email, '{"version":1,"task1":[{"item":"x","passed":false,"detail":"Revisa: 500"}],"task2":null}')
  returning id into att_flagged;

  -- ===== Worker A creates links ==========================================
  perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', google)::text, true);
  execute 'set local role authenticated';

  insert into public.cruce_proof_links (attempt_id) values (att) returning id, token into link_plain, tok_plain;
  insert into public.cruce_proof_links (attempt_id, display_name, include_answers) values (att, 'Lupita M.', true) returning token into tok_full;
  insert into public.cruce_proof_links (attempt_id) values (att_flagged) returning token into tok_flagged;
  results := results || format('%s 01 A creates links (plain, with name + answers, flagged attempt)', case when tok_plain is not null and tok_full is not null and tok_flagged is not null then 'PASS' else 'FAIL' end);
  if tok_plain is null or tok_full is null or tok_flagged is null then fails := fails + 1; end if;

  begin
    insert into public.cruce_proof_links (attempt_id, display_name) values (att, repeat('x', 61));
    ok := false; err := 'insert succeeded';
  exception when check_violation then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 02 display name over 60 characters is rejected %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  begin
    update public.cruce_proof_links set include_answers = true where id = link_plain;
    ok := false; err := 'update succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 03 A cannot change what a link shows after creating it %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  -- ===== Worker B ==========================================================
  perform set_config('request.jwt.claims', jsonb_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', google)::text, true);
  begin
    insert into public.cruce_proof_links (attempt_id, include_answers) values (att, true);
    ok := false; err := 'insert succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 04 B cannot create a link (with answers) for A''s attempt %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  -- ===== Signed-out visitor ===============================================
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';

  select * into rec from public.cruce_proof_by_token(tok_plain);
  ok := coalesce(found and rec.numbers_ok and rec.review_explained and rec.display_name is null
        and not rec.include_answers and rec.email_answer is null and rec.followup_answer is null, false);
  results := results || format('%s 05 plain link: states and date only (numbers_ok=%s, explained=%s, name=%s, answers=%s)', case when ok then 'PASS' else 'FAIL' end,
    rec.numbers_ok, rec.review_explained, coalesce(rec.display_name, 'null'), rec.email_answer is not null);
  if not ok then fails := fails + 1; end if;

  select * into rec from public.cruce_proof_by_token(tok_full);
  ok := coalesce(found and rec.display_name = 'Lupita M.' and rec.include_answers and rec.email_answer = email and rec.followup_answer = followup, false);
  results := results || format('%s 06 link with "Incluir mis respuestas": name and both answers shown', case when ok then 'PASS' else 'FAIL' end);
  if not ok then fails := fails + 1; end if;

  select * into rec from public.cruce_proof_by_token(tok_flagged);
  ok := coalesce(found and rec.numbers_ok = false and rec.review_explained is null, false);
  results := results || format('%s 07 flagged attempt: numbers_ok=false, explained=null (not reviewed)', case when ok then 'PASS' else 'FAIL' end);
  if not ok then fails := fails + 1; end if;

  select count(*) into n
  from information_schema.routines rt
  join information_schema.parameters p on p.specific_name = rt.specific_name
  where rt.routine_schema = 'public' and rt.routine_name = 'cruce_proof_by_token'
    and p.parameter_mode = 'OUT'
    and p.parameter_name in ('user_id', 'email', 'ai_suggestion', 'note', 'review_note', 'attempt_id', 'token');
  ok := n = 0;
  results := results || format('%s 08 the function has no user_id/email/ai_suggestion/note/id columns (found=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  select count(*) into n from public.cruce_proof_by_token(tok_full) t
  where t::text like '%SECRET-AI-TEXT%' or t::text like '%SECRET-REVIEW-NOTE%' or t::text like '%cruce-proof-a@%';
  ok := n = 0;
  results := results || format('%s 09 no AI suggestion, reviewer note or email in any returned value (hits=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  select count(*) into n from public.cruce_proof_by_token(repeat('0', 64));
  ok := n = 0;
  results := results || format('%s 10 unknown token: no rows (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  select count(*) into n from public.cruce_proof_by_token('%');
  ok := n = 0;
  results := results || format('%s 11 malformed token (''%%''): no rows (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  begin
    select count(*) into n from public.cruce_proof_links;
    ok := false; err := format('read %s rows', n);
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 12 signed-out visitor cannot list proof links %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  -- ===== A revokes the plain link =========================================
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', google)::text, true);
  update public.cruce_proof_links set revoked = true where id = link_plain;
  get diagnostics n = row_count;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  select count(*) into n from public.cruce_proof_by_token(tok_plain);
  ok := n = 0;
  results := results || format('%s 13 revoked link: no rows, same as unknown (rows=%s)  <-- F7 acceptance', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  select count(*) into n from public.cruce_proof_by_token(tok_full);
  ok := n = 1;
  results := results || format('%s 14 the other link for the same attempt still works (rows=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  raise exception using
    message = format(
      E'CRUCE PROOF LINK TEST: %s — %s of %s passed. All changes rolled back; nothing was saved.\n%s',
      case when fails = 0 then 'ALL PASS' else fails || ' FAILED' end,
      array_length(results, 1) - fails,
      array_length(results, 1),
      array_to_string(results, E'\n')
    );
end
$test$;

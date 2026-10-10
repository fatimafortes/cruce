-- Cruce F5: daily-limit test. Run in Supabase → SQL Editor AFTER both migrations.
--
-- NOTHING IS SAVED: same pattern as cruce_rls_test.sql. One DO block that ends
-- by raising an error on purpose; the error carries the PASS/FAIL report and
-- makes Postgres undo every change (temporary users, attempts, usage counts).
-- Expect a red error box that starts with "CRUCE DAILY LIMIT TEST".

do $test$
declare
  a uuid := gen_random_uuid();   -- worker A (Google)
  b uuid := gen_random_uuid();   -- worker B (Google)
  google jsonb := '{"provider":"google","providers":["google"]}';
  email text := repeat('Hi Sarah, PO-48213 BRK-2207-A: 800 shipped, 400 pending, new date Nov 14. ', 2);
  first_a uuid; tmp uuid;
  n int; ok boolean; err text;
  results text[] := '{}';
  fails int := 0;
begin
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, is_anonymous, created_at, updated_at)
  values
    (a, 'authenticated', 'authenticated', 'cruce-limit-a@example.invalid', google, '{}', false, now(), now()),
    (b, 'authenticated', 'authenticated', 'cruce-limit-b@example.invalid', google, '{}', false, now(), now());
  -- Usage from yesterday must not count today.
  insert into public.cruce_daily_usage (user_id, day, attempts) values (b, public.cruce_today() - 1, 5);

  -- ===== Worker A ==========================================================
  perform set_config('request.jwt.claims', jsonb_build_object('sub', a, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', google)::text, true);
  execute 'set local role authenticated';

  select public.cruce_attempts_left_today() into n;
  ok := n = 5;
  results := results || format('%s 01 A starts the day with 5 left (left=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  n := 0;
  for i in 1..5 loop
    begin
      insert into public.cruce_attempts (email_answer) values (email) returning id into tmp;
      if i = 1 then first_a := tmp; end if;
      n := n + 1;
    exception when others then err := sqlerrm; end;
  end loop;
  ok := n = 5;
  results := results || format('%s 02 A creates attempts 1 to 5 (created=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  select public.cruce_attempts_left_today() into n;
  ok := n = 0;
  results := results || format('%s 03 A has 0 left (left=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  begin
    insert into public.cruce_attempts (email_answer) values (email);
    ok := false; err := 'insert succeeded';
  exception when others then ok := sqlerrm = 'cruce_daily_limit'; err := sqlerrm; end;
  results := results || format('%s 04 A''s 6th attempt is rejected with cruce_daily_limit (%s)', case when ok then 'PASS' else 'FAIL' end, err);
  if not ok then fails := fails + 1; end if;

  delete from public.cruce_attempts where id = first_a;
  get diagnostics n = row_count;
  begin
    insert into public.cruce_attempts (email_answer) values (email);
    ok := false; err := 'insert succeeded';
  exception when others then ok := sqlerrm = 'cruce_daily_limit'; err := sqlerrm; end;
  results := results || format('%s 05 deleting an attempt (deleted=%s) does not free a slot (%s)', case when ok then 'PASS' else 'FAIL' end, n, err);
  if not ok then fails := fails + 1; end if;

  begin
    select count(*) into n from public.cruce_daily_usage;
    ok := false; err := format('read %s rows', n);
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 06 A cannot read cruce_daily_usage %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  begin
    update public.cruce_daily_usage set attempts = 0 where user_id = a;
    ok := false; err := 'update succeeded';
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 07 A cannot reset own count %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  -- ===== Worker B ==========================================================
  perform set_config('request.jwt.claims', jsonb_build_object('sub', b, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', google)::text, true);

  begin
    insert into public.cruce_attempts (email_answer) values (email);
    ok := true; err := null;
  exception when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 08 B is not affected by A''s limit or by own usage yesterday %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  select public.cruce_attempts_left_today() into n;
  ok := n = 4;
  results := results || format('%s 09 B has 4 left after one attempt (left=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  begin
    insert into public.cruce_attempts (email_answer) values ('too short');
    ok := false; err := 'insert succeeded';
  exception when check_violation then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  select public.cruce_attempts_left_today() into n;
  ok := ok and n = 4;
  results := results || format('%s 10 a rejected insert (too short) does not use a slot (left=%s) %s', case when ok then 'PASS' else 'FAIL' end, n, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  -- ===== Signed-out visitor ================================================
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    select public.cruce_attempts_left_today() into n;
    ok := false; err := format('returned %s', n);
  exception when insufficient_privilege then ok := true; err := null;
            when others then ok := false; err := sqlerrm; end;
  results := results || format('%s 11 signed-out visitor cannot call cruce_attempts_left_today %s', case when ok then 'PASS' else 'FAIL' end, coalesce(err, ''));
  if not ok then fails := fails + 1; end if;

  execute 'reset role';
  select attempts into n from public.cruce_daily_usage where user_id = a and day = public.cruce_today();
  ok := n = 5;
  results := results || format('%s 12 A''s stored count is 5, not 6 or 7 (rejected inserts rolled back) (count=%s)', case when ok then 'PASS' else 'FAIL' end, n);
  if not ok then fails := fails + 1; end if;

  raise exception using
    message = format(
      E'CRUCE DAILY LIMIT TEST: %s — %s of %s passed. All changes rolled back; nothing was saved.\n%s',
      case when fails = 0 then 'ALL PASS' else fails || ' FAILED' end,
      array_length(results, 1) - fails,
      array_length(results, 1),
      array_to_string(results, E'\n')
    );
end
$test$;

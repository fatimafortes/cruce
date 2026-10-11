-- Cruce security floor 3 evidence: RLS on every table with user data.
-- Read-only. Run in Supabase → SQL Editor; it changes nothing.
-- One row per cruce_ table: RLS on/off, number of policies, and whether the
-- public API roles can read the table at all (table grants, before RLS), and
-- whether signed-in users may insert into at least some columns (Cruce grants
-- inserts per column, e.g. workers can write only their answers). RLS then
-- decides which rows.

select
  c.relname                                                            as table_name,
  c.relrowsecurity                                                     as rls_on,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname)         as policies,
  has_table_privilege('anon', c.oid, 'select')                         as signed_out_can_select,
  has_table_privilege('authenticated', c.oid, 'select')                as signed_in_can_select,
  has_any_column_privilege('authenticated', c.oid, 'insert')           as signed_in_can_insert_some_columns
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'cruce\_%'
order by c.relname;

-- ============================================================================
-- STEP 2: delete the OLD HR Admin / Manager / Employee accounts and their records.
--
-- BEFORE YOU RUN THIS:
--   1. Take a backup (docs/db-cleanup/00-BACKUP.md).
--   2. Run 01-preview.sql and read every result.
--   3. Edit the THREE values in the "cleanup_params" block below.
--
-- What it does NOT touch: any SUPER_ADMIN account (so your .env Super Admin keeps its
-- e-mail and password), tables/structure, departments, designations, leave types, holidays,
-- organization settings, announcements, and the audit log.
--
-- It is ONE transaction. If any check fails, everything is rolled back and nothing is deleted.
-- It also stores a copy of every affected table in the "cleanup_backup" schema first.
-- ============================================================================
begin;

-- ===================== EDIT THESE 3 VALUES =====================
create temp table cleanup_params on commit drop as
select
  'admin@graapes.com'::text as keep_email,      -- your Super Admin e-mail (the SUPER_ADMIN_EMAIL in .env)
  0::int                    as expected_accounts, -- the number printed by 01-preview.sql (query C)
  false::boolean            as delete_orphan_employees; -- true = also delete employees that have no login account
-- ================================================================

-- Guard 1: the account you keep must exist exactly once and must be a SUPER_ADMIN.
do $$
begin
  if (select count(*) from "UserAccount" u, cleanup_params p
      where lower(u.email) = lower(p.keep_email) and u.role = 'SUPER_ADMIN') <> 1 then
    raise exception 'STOPPED: keep_email is not an existing SUPER_ADMIN account. Nothing was deleted.';
  end if;
end $$;

-- The accounts to delete: HR / Manager / Employee only, never the kept account, never any SUPER_ADMIN.
create temp table del_users on commit drop as
select u.id
from "UserAccount" u, cleanup_params p
where u.role in ('HR_ADMIN', 'MANAGER', 'EMPLOYEE')
  and lower(u.email) <> lower(p.keep_email);

-- Guard 2: the number must match what you saw in the preview (stops you deleting the wrong set).
do $$
declare found int; wanted int;
begin
  select count(*) into found from del_users;
  select expected_accounts into wanted from cleanup_params;
  if found <> wanted then
    raise exception 'STOPPED: % accounts would be deleted but expected_accounts is %. Re-run 01-preview.sql. Nothing was deleted.', found, wanted;
  end if;
end $$;

-- The employee records that belong to those accounts (the Super Admin''s own employee record, if any, is never included).
create temp table del_emp on commit drop as
select e.id
from "Employee" e, cleanup_params p
where e."userAccountId" in (select id from del_users)
   or (p.delete_orphan_employees and e."userAccountId" is null);

-- Backup copy of every affected table, inside the database (schema "cleanup_backup", names end with a timestamp).
do $$
declare
  suffix text := to_char(now() at time zone 'utc', 'YYYYMMDD_HH24MISS');
  t text;
begin
  execute 'create schema if not exists cleanup_backup';
  foreach t in array array['UserAccount','Employee','AttendancePunch','AttendanceRecord','AttendanceCorrection',
                           'LeaveLedgerEntry','LeaveRequest','LeaveRequestEvent','EmployeeDocument','HRLetter',
                           'EmployeeHistory','Notification','Department','IdSequence']
  loop
    if to_regclass(format('%I', t)) is not null then
      execute format('create table cleanup_backup.%I as table %I', t || '_' || suffix, t);
    end if;
  end loop;
  raise notice 'Backup copies created in schema cleanup_backup with suffix %', suffix;
end $$;

-- Detach the people who stay from the people who go (their own records are kept, only the link is removed).
update "Employee"             set "managerId"  = null where "managerId"  in (select id from del_emp) and id not in (select id from del_emp);
update "Department"           set "headId"     = null where "headId"     in (select id from del_emp);
update "AttendanceCorrection" set "approverId" = null where "approverId" in (select id from del_emp) and "employeeId" not in (select id from del_emp);
update "LeaveRequest"         set "approverId" = null where "approverId" in (select id from del_emp) and "employeeId" not in (select id from del_emp);

-- Delete the linked records, children first.
delete from "AttendanceCorrection" where "employeeId" in (select id from del_emp) or "approverId" in (select id from del_emp);
delete from "AttendancePunch"      where "employeeId" in (select id from del_emp);
delete from "AttendanceRecord"     where "employeeId" in (select id from del_emp);
delete from "LeaveLedgerEntry"     where "employeeId" in (select id from del_emp);
delete from "LeaveRequestEvent"    where "leaveRequestId" in (select id from "LeaveRequest" where "employeeId" in (select id from del_emp));
delete from "LeaveRequest"         where "employeeId" in (select id from del_emp);
delete from "HRLetter"             where "employeeId" in (select id from del_emp);
delete from "EmployeeDocument"     where "employeeId" in (select id from del_emp);
delete from "EmployeeHistory"      where "employeeId" in (select id from del_emp);
delete from "Employee"             where id in (select id from del_emp);
delete from "Notification"         where "userId" in (select id from del_users);
delete from "UserAccount"          where id in (select id from del_users);

-- New IDs start again from GRA-HR-0001 / GRA-MGR-0001 / GRA-EMP-0001.
do $$
begin
  if to_regclass('"IdSequence"') is not null then
    update "IdSequence" set "value" = 0 where "key" in ('GRA-HR-', 'GRA-MGR-', 'GRA-EMP-');
  end if;
end $$;

-- Guard 3: final safety checks. Any failure rolls everything back.
do $$
begin
  if (select count(*) from "UserAccount" u, cleanup_params p
      where lower(u.email) = lower(p.keep_email) and u.role = 'SUPER_ADMIN') <> 1 then
    raise exception 'STOPPED: the Super Admin account is missing after cleanup. Rolled back.';
  end if;
  if exists (select 1 from "UserAccount" u, cleanup_params p
             where u.role in ('HR_ADMIN','MANAGER','EMPLOYEE') and lower(u.email) <> lower(p.keep_email)) then
    raise exception 'STOPPED: some old accounts are still present. Rolled back.';
  end if;
end $$;

commit;

-- Now run 03-verify.sql.

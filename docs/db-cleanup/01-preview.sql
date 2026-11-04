-- ============================================================================
-- STEP 1 (READ-ONLY): preview what the cleanup would delete.
-- Safe to run any number of times. It changes NOTHING.
-- Run it in Supabase -> SQL Editor. Each SELECT shows its own result tab.
-- ============================================================================

-- A) The Super Admin account(s). The cleanup NEVER deletes any SUPER_ADMIN account.
select id, email, role, "isActive", "displayName"
from "UserAccount"
where role = 'SUPER_ADMIN'
order by "createdAt";

-- B) Accounts the cleanup WOULD delete (every HR_ADMIN / MANAGER / EMPLOYEE account except the one you keep).
--    Replace the e-mail below with YOUR Super Admin e-mail if you want to see the exact same list as the cleanup.
select u.email, u.role, u."displayName", e."employeeCode"
from "UserAccount" u
left join "Employee" e on e."userAccountId" = u.id
where u.role in ('HR_ADMIN', 'MANAGER', 'EMPLOYEE')
  and lower(u.email) <> lower('admin@graapes.com')
order by u.role, u.email;

-- C) THE NUMBER to put into "expected_accounts" in 02-cleanup.sql
select count(*) as expected_accounts
from "UserAccount"
where role in ('HR_ADMIN', 'MANAGER', 'EMPLOYEE')
  and lower(email) <> lower('admin@graapes.com');

-- D) How many linked records will go with them
with del_users as (
  select id from "UserAccount"
  where role in ('HR_ADMIN', 'MANAGER', 'EMPLOYEE') and lower(email) <> lower('admin@graapes.com')
), del_emp as (
  select id from "Employee" where "userAccountId" in (select id from del_users)
)
select 'Employee' as "table", count(*) as rows_to_delete from del_emp
union all select 'AttendancePunch', count(*) from "AttendancePunch" where "employeeId" in (select id from del_emp)
union all select 'AttendanceRecord', count(*) from "AttendanceRecord" where "employeeId" in (select id from del_emp)
union all select 'AttendanceCorrection', count(*) from "AttendanceCorrection" where "employeeId" in (select id from del_emp)
union all select 'LeaveLedgerEntry', count(*) from "LeaveLedgerEntry" where "employeeId" in (select id from del_emp)
union all select 'LeaveRequest', count(*) from "LeaveRequest" where "employeeId" in (select id from del_emp)
union all select 'EmployeeDocument', count(*) from "EmployeeDocument" where "employeeId" in (select id from del_emp)
union all select 'HRLetter', count(*) from "HRLetter" where "employeeId" in (select id from del_emp)
union all select 'EmployeeHistory', count(*) from "EmployeeHistory" where "employeeId" in (select id from del_emp)
union all select 'Notification', count(*) from "Notification" where "userId" in (select id from del_users);

-- E) Employee records that have NO login account (orphans). The cleanup keeps them unless you switch
--    "delete_orphan_employees" to true in 02-cleanup.sql. Check this list before you do.
select e."employeeCode", e."fullName", e."workEmail"
from "Employee" e
where e."userAccountId" is null
order by e."employeeCode";

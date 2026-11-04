-- ============================================================================
-- STEP 3 (READ-ONLY): verify the result after 02-cleanup.sql
-- ============================================================================

-- Only your Super Admin should be left (plus any account you created after the cleanup).
select email, role, "isActive" from "UserAccount" order by "createdAt";

-- Remaining employee records and their IDs.
select "employeeCode", "fullName", "workEmail" from "Employee" order by "employeeCode";

-- Counters for the generated IDs (should be 0 right after cleanup; they go up as you create accounts).
select * from "IdSequence" order by "key";

-- Nothing should point at a missing person (all of these must return 0 rows).
select 'Employee -> UserAccount' as problem, count(*) from "Employee" e
  where e."userAccountId" is not null and not exists (select 1 from "UserAccount" u where u.id = e."userAccountId")
union all select 'AttendanceRecord -> Employee', count(*) from "AttendanceRecord" r
  where not exists (select 1 from "Employee" e where e.id = r."employeeId")
union all select 'LeaveRequest -> Employee', count(*) from "LeaveRequest" r
  where not exists (select 1 from "Employee" e where e.id = r."employeeId");

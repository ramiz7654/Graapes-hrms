# Step 0: Back up before you delete anything

Do at least ONE of these. The cleanup script (`02-cleanup.sql`) also copies every affected table into a
`cleanup_backup` schema inside the same database, but that is not a substitute for a real backup:
if the whole database were lost, those copies would be lost with it.

## Option A: full dump with pg_dump (recommended)
You need the PostgreSQL client tools (they are installed together with PostgreSQL 16 on Windows).
Use the **Session pooler** connection string from Supabase (Connect -> Session pooler). Do not paste it anywhere public.

```cmd
pg_dump "postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" --no-owner --format=custom --file=graapes-before-cleanup.dump
```

Keep `graapes-before-cleanup.dump` somewhere safe. Restore (only if needed, into an empty database) with `pg_restore --no-owner --dbname=<connection string> graapes-before-cleanup.dump`.

## Option B: export from the Supabase dashboard
Supabase -> Project -> Database -> Backups (available backups depend on your plan; the free plan has no downloadable daily backup, so use Option A).

## Option C: export the key tables as CSV
Supabase -> Table Editor -> pick `UserAccount`, `Employee`, `LeaveLedgerEntry`, ... -> Export to CSV.

## Restoring from the in-database copies
After `02-cleanup.sql` has run, the copies are tables such as `cleanup_backup."UserAccount_20261104_101500"`.
List them with:
```sql
select table_name from information_schema.tables where table_schema = 'cleanup_backup' order by 1;
```
Once you are sure you do not need them, remove them with `drop schema cleanup_backup cascade;`

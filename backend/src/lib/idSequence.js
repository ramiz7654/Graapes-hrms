/**
 * Role-based login IDs: GRA-HR-0001, GRA-MGR-0001, GRA-EMP-0001.
 *
 * The counter lives in PostgreSQL ("IdSequence"). It is read with SELECT ... FOR UPDATE inside the
 * same transaction that creates the employee, so two simultaneous requests are serialised by the
 * row lock and can never receive the same number. The counter only ever goes up, so the ID of a
 * deleted person is never handed to somebody else. It also never falls below the highest ID that
 * already exists, so old/imported records cannot cause a duplicate.
 */
export const ID_PREFIX = { HR_ADMIN: 'GRA-HR-', MANAGER: 'GRA-MGR-', EMPLOYEE: 'GRA-EMP-' };

/** @param tx a Prisma transaction client  @param role HR_ADMIN | MANAGER | EMPLOYEE */
export async function nextEmployeeCode(tx, role) {
  const prefix = ID_PREFIX[role];
  if (!prefix) throw new Error(`No ID prefix configured for role ${role}`);

  await tx.$executeRaw`INSERT INTO "IdSequence" ("key", "value") VALUES (${prefix}, 0) ON CONFLICT ("key") DO NOTHING`;
  const rows = await tx.$queryRaw`SELECT "value" FROM "IdSequence" WHERE "key" = ${prefix} FOR UPDATE`;
  const counter = Number(rows[0]?.value ?? 0);

  const existing = await tx.employee.findMany({ where: { employeeCode: { startsWith: prefix } }, select: { employeeCode: true } });
  const highestExisting = existing.reduce((max, row) => Math.max(max, Number(row.employeeCode.slice(prefix.length)) || 0), 0);

  const next = Math.max(counter, highestExisting) + 1;
  await tx.$executeRaw`UPDATE "IdSequence" SET "value" = ${next} WHERE "key" = ${prefix}`;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

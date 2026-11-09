-- Company locations (offices/states). Employee.workLocation and Holiday.location keep storing the location name.
CREATE TABLE "CompanyLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "isHeadquarters" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyLocation_name_key" ON "CompanyLocation"("name");

-- Default headquarters so existing employees (default workLocation 'Headquarters') stay valid.
INSERT INTO "CompanyLocation" ("id", "name", "isHeadquarters", "updatedAt")
VALUES ('loc_headquarters', 'Headquarters', true, CURRENT_TIMESTAMP);

-- Keep every location name already used by employees or holidays, so nothing becomes invalid.
INSERT INTO "CompanyLocation" ("id", "name", "updatedAt")
SELECT 'loc_' || md5(src."name"), src."name", CURRENT_TIMESTAMP
FROM (
    SELECT TRIM("workLocation") AS "name" FROM "Employee" WHERE "workLocation" IS NOT NULL AND TRIM("workLocation") <> ''
    UNION
    SELECT TRIM("location") AS "name" FROM "Holiday" WHERE "location" IS NOT NULL AND TRIM("location") <> '' AND LOWER(TRIM("location")) NOT IN ('all locations', 'all')
) AS src
WHERE src."name" NOT IN (SELECT "name" FROM "CompanyLocation");

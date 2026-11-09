-- Announcements can now target specific designations (audience type ROLE + designationId).
ALTER TABLE "AnnouncementAudience" ADD COLUMN "designationId" TEXT;

ALTER TABLE "AnnouncementAudience"
  ADD CONSTRAINT "AnnouncementAudience_designationId_fkey"
  FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

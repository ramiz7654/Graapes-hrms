CREATE TABLE "NotificationReadState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationReadState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationReadState_userId_notificationKey_key" ON "NotificationReadState"("userId", "notificationKey");
CREATE INDEX "NotificationReadState_userId_readAt_idx" ON "NotificationReadState"("userId", "readAt");

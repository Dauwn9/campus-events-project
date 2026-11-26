CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');
CREATE TYPE "NotificationKind" AS ENUM ('EVENT_CANCELLED', 'EVENT_UPDATED');
CREATE TYPE "AuditEntityType" AS ENUM ('EVENT', 'USER', 'CATEGORY');

ALTER TABLE "Registration"
ADD COLUMN "shortCode" TEXT;

CREATE UNIQUE INDEX "Registration_shortCode_key"
ON "Registration"("shortCode");

CREATE TABLE "Friendship" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "pairKey" TEXT NOT NULL,
  "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Friendship_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Friendship_recipientId_fkey"
    FOREIGN KEY ("recipientId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Friendship_pairKey_key"
ON "Friendship"("pairKey");
CREATE INDEX "Friendship_recipientId_status_idx"
ON "Friendship"("recipientId", "status");
CREATE INDEX "Friendship_requesterId_status_idx"
ON "Friendship"("requesterId", "status");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Notification_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Notification_userId_createdAt_idx"
ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_eventId_idx"
ON "Notification"("eventId");

CREATE TABLE "AuditEntry" (
  "id" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "entityType" "AuditEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityLabel" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "oldValue" TEXT NOT NULL,
  "newValue" TEXT NOT NULL,
  CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEntry_occurredAt_idx"
ON "AuditEntry"("occurredAt");
CREATE INDEX "AuditEntry_entityType_entityId_occurredAt_idx"
ON "AuditEntry"("entityType", "entityId", "occurredAt");

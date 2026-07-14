ALTER TABLE "User"
ADD COLUMN "emailVerificationToken" TEXT,
ADD COLUMN "emailVerificationExpires" TIMESTAMP(3);

CREATE INDEX "User_emailVerificationToken_idx" ON "User"("emailVerificationToken");

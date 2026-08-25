-- The credentials provider had no rate limiting, so the admin login was open to
-- unlimited password guessing. bcrypt at cost 10 makes that slow, not
-- impossible. Throttling needs somewhere durable to count from: an in-process
-- counter resets on every cold start and is not shared between instances, so it
-- would be no control at all on serverless.
--
-- Only failures are recorded. A successful sign-in clears the identifier's
-- history, so an admin who mistypes twice and then gets it right starts clean.
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- Both lookups are "failures for X since T", and both are also the shape the
-- periodic prune deletes by.
CREATE INDEX "LoginAttempt_identifier_createdAt_idx" ON "LoginAttempt"("identifier", "createdAt");
CREATE INDEX "LoginAttempt_ip_createdAt_idx" ON "LoginAttempt"("ip", "createdAt");
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

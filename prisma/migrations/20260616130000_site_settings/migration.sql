CREATE TABLE "SiteSettings" (
    "id"              TEXT        NOT NULL DEFAULT 'default',
    "showSearchInNav" BOOLEAN     NOT NULL DEFAULT true,
    "showSampleInNav" BOOLEAN     NOT NULL DEFAULT true,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SiteSettings" ("id", "showSearchInNav", "showSampleInNav", "updatedAt")
VALUES ('default', true, true, NOW())
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "SiteSettings"
ADD COLUMN "scrollToTopOnCatalogTapMobile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "scrollToTopOnCatalogTapDesktop" BOOLEAN NOT NULL DEFAULT false;

-- Carry forward the prior unified setting to both platforms.
UPDATE "SiteSettings"
SET "scrollToTopOnCatalogTapMobile" = "scrollToTopOnCatalogTap",
    "scrollToTopOnCatalogTapDesktop" = "scrollToTopOnCatalogTap";

ALTER TABLE "SiteSettings"
DROP COLUMN "scrollToTopOnCatalogTap";

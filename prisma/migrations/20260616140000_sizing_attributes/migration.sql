CREATE TABLE "SizingAttribute" (
    "id"          TEXT         NOT NULL,
    "title"       TEXT         NOT NULL,
    "description" TEXT,
    "category"    TEXT         NOT NULL,
    "enabled"     BOOLEAN      NOT NULL DEFAULT true,
    "sortOrder"   INTEGER      NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SizingAttribute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SizingAttribute_category_idx" ON "SizingAttribute"("category");

-- Seed: Upper Body defaults from the design.
INSERT INTO "SizingAttribute" ("id", "title", "description", "category", "enabled", "sortOrder", "updatedAt") VALUES
    ('seed_upbody_length',   'Length',   'back of collar to bottom hem', 'Upper Body', true, 1, NOW()),
    ('seed_upbody_chest',    'Chest',    'underarm to underarm',         'Upper Body', true, 2, NOW()),
    ('seed_upbody_waist',    'Waist',    'circumference closed',         'Upper Body', true, 3, NOW()),
    ('seed_upbody_shoulder', 'Shoulder', 'collar to shoulder',           'Upper Body', true, 4, NOW()),
    ('seed_upbody_sleeve',   'Sleeve',   'shoulder to cuff',             'Upper Body', true, 5, NOW()),
    ('seed_upbody_bicep',    'Bicep',    'circumference',                'Upper Body', true, 6, NOW()),
    ('seed_upbody_cuff',     'Cuff',     'circumference',                'Upper Body', true, 7, NOW())
ON CONFLICT ("id") DO NOTHING;

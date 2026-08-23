-- Order numbers were generated as count() + 1, which two concurrent checkouts
-- can read before either writes, colliding on the unique orderNumber. A
-- sequence hands out each value exactly once. The displayed format is
-- unchanged: still a zero-padded ascending counter.
CREATE SEQUENCE IF NOT EXISTS "order_number_seq" AS bigint START WITH 1;

-- Continue from the highest existing number. Only purely numeric order numbers
-- are considered; is_called = false makes the next nextval() return this value.
SELECT setval(
    'order_number_seq',
    COALESCE(
        (SELECT MAX("orderNumber"::bigint) FROM "Order" WHERE "orderNumber" ~ '^[0-9]+$'),
        0
    ) + 1,
    false
);

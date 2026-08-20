-- Human-readable, sequential application ID (MV0001, MV0002, ...) shown throughout the admin UI
-- in place of the raw UUID. Backfills every existing row in submission order (oldest = MV0001)
-- and wires up a sequence so every future INSERT gets the next number automatically -- e.g. with
-- 98 existing rows, the next application submitted becomes MV0099.

-- 1. Sequence backing the number. Not attached as the column's DEFAULT until step 5 below, so
--    the explicit, order-controlled backfill in step 3 runs first -- a plain `DEFAULT
--    nextval(...)` on ADD COLUMN would number existing rows in whatever order Postgres happens
--    to scan the table, which is not guaranteed to match submission (created_at) order.
CREATE SEQUENCE IF NOT EXISTS public.startups_application_seq;

-- 2. Nullable integer column, backfilled explicitly below.
ALTER TABLE public.startups
    ADD COLUMN IF NOT EXISTS application_seq INTEGER;

-- 3. Backfill any row that doesn't have a number yet, oldest submission first. Safe to re-run --
--    only touches rows where application_seq IS NULL, so it's a no-op once every row has one.
WITH ordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
    FROM public.startups
    WHERE application_seq IS NULL
)
UPDATE public.startups s
SET application_seq = ordered.rn
FROM ordered
WHERE s.id = ordered.id;

-- 4. Point the sequence past the highest number just assigned so the very next INSERT
--    continues correctly instead of colliding with a backfilled value.
SELECT setval(
    'public.startups_application_seq',
    COALESCE((SELECT MAX(application_seq) FROM public.startups), 0) + 1,
    false
);

-- 5. Attach the sequence as the column's default for all future inserts, lock down NOT NULL, and
--    tie the sequence's lifecycle to the column (dropped together if the column ever is).
ALTER TABLE public.startups
    ALTER COLUMN application_seq SET DEFAULT nextval('public.startups_application_seq'),
    ALTER COLUMN application_seq SET NOT NULL;
ALTER SEQUENCE public.startups_application_seq OWNED BY public.startups.application_seq;

CREATE UNIQUE INDEX IF NOT EXISTS idx_startups_application_seq ON public.startups(application_seq);

-- 6. Human-readable generated column: 'MV' + zero-padded number, e.g. MV0098. STORED (not
--    VIRTUAL) so it's a real column the API can select/search/sort on directly like any other,
--    and Postgres computes it for every existing row automatically from application_seq (already
--    backfilled above) the moment this column is added.
--
--    GREATEST(4, ...) guards against silent truncation: plain `LPAD(n, 4, '0')` TRUNCATES (not
--    widens) once n has more than 4 digits, so application #10000 would render as "MV1000" with
--    the trailing digit silently dropped. This keeps the minimum width at 4 digits but lets it
--    grow past that once the count ever exceeds 9999.
ALTER TABLE public.startups
    ADD COLUMN IF NOT EXISTS application_id TEXT GENERATED ALWAYS AS (
        'MV' || LPAD(application_seq::text, GREATEST(4, LENGTH(application_seq::text)), '0')
    ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_startups_application_id ON public.startups(application_id);

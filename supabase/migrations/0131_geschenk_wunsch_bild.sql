-- 0131_geschenk_wunsch_bild.sql
-- Adds an optional product image to geschenk_wuensche (R2-backed, like other
-- file uploads in the app — see lib/files/worker-client.ts). Stores the R2
-- object key only; display URLs are generated on-demand via presigned GET
-- (see app/api/geschenke/[wishId]/image/route.ts).

ALTER TABLE geschenk_wuensche
  ADD COLUMN IF NOT EXISTS image_r2_key TEXT;

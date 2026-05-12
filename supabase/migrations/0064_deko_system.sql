-- ════════════════════════════════════════════════════════════════════════════
-- 0064 – DEKO SYSTEM v2
-- Replaces decor_setup_items + deko_wishes with a fully visual canvas system.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Drop old tables ───────────────────────────────────────────────────────
DROP TABLE IF EXISTS decor_setup_items CASCADE;
DROP TABLE IF EXISTS deko_wishes       CASCADE;

-- ── 2. Organizer-level templates (global, not per-event) ────────────────────

CREATE TABLE IF NOT EXISTS deko_organizer_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT,
  preview_image_url TEXT,
  sort_order    INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deko_template_areas (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID  NOT NULL REFERENCES deko_organizer_templates(id) ON DELETE CASCADE,
  name        TEXT  NOT NULL,
  color       TEXT  NOT NULL DEFAULT '#C9B99A',
  sort_order  INT   NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS deko_template_items (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id   UUID    NOT NULL REFERENCES deko_template_areas(id) ON DELETE CASCADE,
  type      TEXT    NOT NULL,
  x         NUMERIC NOT NULL DEFAULT 0,
  y         NUMERIC NOT NULL DEFAULT 0,
  width     NUMERIC NOT NULL DEFAULT 200,
  height    NUMERIC NOT NULL DEFAULT 150,
  z_index   INT     NOT NULL DEFAULT 0,
  data      JSONB   NOT NULL DEFAULT '{}'
);

-- Organizer-level flat rate templates (global defaults)
CREATE TABLE IF NOT EXISTS deko_organizer_flat_rates (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id  UUID         REFERENCES deko_organizer_templates(id) ON DELETE SET NULL,
  name         TEXT         NOT NULL,
  description  TEXT,
  amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 3. Per-event: flat rates ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deko_flat_rates (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name                  TEXT         NOT NULL,
  description           TEXT,
  amount                NUMERIC(10,2) NOT NULL DEFAULT 0,
  from_organizer_rate_id UUID        REFERENCES deko_organizer_flat_rates(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 4. Per-event: article catalog ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deko_catalog_items (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  item_type      TEXT         NOT NULL DEFAULT 'article'
                              CHECK (item_type IN ('article', 'fabric')),
  name           TEXT         NOT NULL,
  image_url      TEXT,

  -- shared fields
  color          TEXT,
  notes          TEXT,

  -- article-specific
  material       TEXT,
  dim_width_cm   NUMERIC,
  dim_height_cm  NUMERIC,
  dim_depth_cm   NUMERIC,
  price_per_unit NUMERIC(10,2),          -- NULL if flat-rate or free
  flat_rate_id   UUID         REFERENCES deko_flat_rates(id) ON DELETE SET NULL,
  is_free        BOOLEAN      NOT NULL DEFAULT FALSE,
  availability   TEXT         CHECK (availability IN ('available', 'limited', 'unavailable')) DEFAULT 'available',

  -- fabric-specific
  fabric_type    TEXT,
  fabric_width_cm NUMERIC,
  price_per_meter NUMERIC(10,2),

  created_by     UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX ON deko_catalog_items(event_id);

-- ── 5. Per-event: areas ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deko_areas (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  color            TEXT        NOT NULL DEFAULT '#C9B99A',
  sort_order       INT         NOT NULL DEFAULT 0,
  from_template_id UUID        REFERENCES deko_organizer_templates(id) ON DELETE SET NULL,
  created_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON deko_areas(event_id);

-- ── 6. Per-event: canvases ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deko_canvases (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  area_id     UUID        REFERENCES deko_areas(id) ON DELETE CASCADE,  -- NULL = moodboard
  name        TEXT        NOT NULL,
  canvas_type TEXT        NOT NULL DEFAULT 'main'
              CHECK (canvas_type IN ('main', 'variant', 'moodboard')),
  is_frozen   BOOLEAN     NOT NULL DEFAULT FALSE,
  frozen_at   TIMESTAMPTZ,
  frozen_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  sort_order  INT         NOT NULL DEFAULT 0,
  created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one main canvas per area
CREATE UNIQUE INDEX deko_canvases_one_main_per_area
  ON deko_canvases(area_id)
  WHERE canvas_type = 'main' AND area_id IS NOT NULL;

CREATE INDEX ON deko_canvases(event_id);
CREATE INDEX ON deko_canvases(area_id);

-- ── 7. Per-event: canvas items ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deko_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id  UUID        NOT NULL REFERENCES deko_canvases(id) ON DELETE CASCADE,
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN (
    'image_upload', 'image_url', 'color_palette', 'color_swatch',
    'text_block', 'sticky_note', 'heading',
    'article', 'flat_rate_article',
    'frame', 'divider', 'area_label',
    'vote_card', 'checklist', 'link_card',
    'table_ref', 'room_info', 'guest_count',
    'fabric'
  )),
  x          NUMERIC     NOT NULL DEFAULT 100,
  y          NUMERIC     NOT NULL DEFAULT 100,
  width      NUMERIC     NOT NULL DEFAULT 240,
  height     NUMERIC     NOT NULL DEFAULT 180,
  z_index    INT         NOT NULL DEFAULT 0,
  data       JSONB       NOT NULL DEFAULT '{}',
  created_by UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON deko_items(canvas_id);
CREATE INDEX ON deko_items(event_id);

-- ── 8. Comments (polymorphic) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deko_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  target_type TEXT        NOT NULL CHECK (target_type IN ('item', 'canvas', 'area')),
  target_id   UUID        NOT NULL,
  content     TEXT        NOT NULL CHECK (TRIM(content) <> ''),
  author_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON deko_comments(event_id);
CREATE INDEX ON deko_comments(target_id);

CREATE TABLE IF NOT EXISTS deko_comment_replies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID        NOT NULL REFERENCES deko_comments(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL CHECK (TRIM(content) <> ''),
  author_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON deko_comment_replies(comment_id);

-- ── 9. Votes ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deko_votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    UUID        NOT NULL REFERENCES deko_items(id) ON DELETE CASCADE,
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote       TEXT        NOT NULL CHECK (vote IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, user_id)
);

CREATE INDEX ON deko_votes(item_id);

-- ── 10. Budget link table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deko_budget_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  deko_item_id   UUID NOT NULL REFERENCES deko_items(id) ON DELETE CASCADE,
  budget_item_id UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (deko_item_id)
);

CREATE INDEX ON deko_budget_links(event_id);

-- ── 11. updated_at trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_deko_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS deko_items_updated_at ON deko_items;
CREATE TRIGGER deko_items_updated_at
  BEFORE UPDATE ON deko_items
  FOR EACH ROW EXECUTE FUNCTION update_deko_items_updated_at();

-- ── 12. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE deko_organizer_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_template_areas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_template_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_organizer_flat_rates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_flat_rates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_catalog_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_areas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_canvases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_items                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_comments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_comment_replies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_votes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_budget_links          ENABLE ROW LEVEL SECURITY;

-- organizer templates: owner only
CREATE POLICY "deko_orgtempl_all" ON deko_organizer_templates FOR ALL
  USING (organizer_id = auth.uid()) WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "deko_orgtempl_area_all" ON deko_template_areas FOR ALL
  USING (EXISTS (SELECT 1 FROM deko_organizer_templates t WHERE t.id = template_id AND t.organizer_id = auth.uid()));

CREATE POLICY "deko_orgtempl_item_all" ON deko_template_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM deko_template_areas a
    JOIN deko_organizer_templates t ON t.id = a.template_id
    WHERE a.id = area_id AND t.organizer_id = auth.uid()
  ));

CREATE POLICY "deko_orgflatrate_all" ON deko_organizer_flat_rates FOR ALL
  USING (organizer_id = auth.uid()) WITH CHECK (organizer_id = auth.uid());

-- flat rates: veranstalter manages, others read
CREATE POLICY "deko_flatrate_select" ON deko_flat_rates FOR SELECT USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
  OR dl_has_tab_access(event_id, 'dekoration', 'read')
);
CREATE POLICY "deko_flatrate_write" ON deko_flat_rates FOR ALL USING (
  is_event_member(event_id, ARRAY['veranstalter']::user_role[])
) WITH CHECK (
  is_event_member(event_id, ARRAY['veranstalter']::user_role[])
);

-- catalog items
CREATE POLICY "deko_catalog_select" ON deko_catalog_items FOR SELECT USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
  OR dl_has_tab_access(event_id, 'dekoration', 'read')
);
CREATE POLICY "deko_catalog_insert" ON deko_catalog_items FOR INSERT WITH CHECK (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  OR dl_has_tab_access(event_id, 'dekoration', 'write')
);
CREATE POLICY "deko_catalog_update" ON deko_catalog_items FOR UPDATE USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  OR (dl_has_tab_access(event_id, 'dekoration', 'write') AND created_by = auth.uid())
);
CREATE POLICY "deko_catalog_delete" ON deko_catalog_items FOR DELETE USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  OR (dl_has_tab_access(event_id, 'dekoration', 'write') AND created_by = auth.uid())
);

-- areas
CREATE POLICY "deko_area_select" ON deko_areas FOR SELECT USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
  OR dl_has_tab_access(event_id, 'dekoration', 'read')
);
CREATE POLICY "deko_area_write" ON deko_areas FOR ALL USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
) WITH CHECK (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
);

-- canvases
CREATE POLICY "deko_canvas_select" ON deko_canvases FOR SELECT USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
  OR dl_has_tab_access(event_id, 'dekoration', 'read')
);
CREATE POLICY "deko_canvas_write" ON deko_canvases FOR ALL USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
) WITH CHECK (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
);

-- items
CREATE POLICY "deko_item_select" ON deko_items FOR SELECT USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
  OR dl_has_tab_access(event_id, 'dekoration', 'read')
);
CREATE POLICY "deko_item_insert" ON deko_items FOR INSERT WITH CHECK (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  OR dl_has_tab_access(event_id, 'dekoration', 'write')
);
CREATE POLICY "deko_item_update" ON deko_items FOR UPDATE USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  OR (dl_has_tab_access(event_id, 'dekoration', 'write') AND created_by = auth.uid())
);
CREATE POLICY "deko_item_delete" ON deko_items FOR DELETE USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  OR (dl_has_tab_access(event_id, 'dekoration', 'write') AND created_by = auth.uid())
);

-- comments: all event members + DL with any access can read/write
CREATE POLICY "deko_comment_select" ON deko_comments FOR SELECT USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
  OR dl_has_tab_access(event_id, 'dekoration', 'read')
);
CREATE POLICY "deko_comment_insert" ON deko_comments FOR INSERT WITH CHECK (
  author_id = auth.uid() AND (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR dl_has_tab_access(event_id, 'dekoration', 'read')
  )
);
CREATE POLICY "deko_comment_update" ON deko_comments FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "deko_comment_delete" ON deko_comments FOR DELETE USING (
  author_id = auth.uid()
  OR is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
);

-- replies
CREATE POLICY "deko_reply_select" ON deko_comment_replies FOR SELECT USING (
  EXISTS (SELECT 1 FROM deko_comments c WHERE c.id = comment_id AND (
    is_event_member(c.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR dl_has_tab_access(c.event_id, 'dekoration', 'read')
  ))
);
CREATE POLICY "deko_reply_insert" ON deko_comment_replies FOR INSERT WITH CHECK (
  author_id = auth.uid() AND EXISTS (
    SELECT 1 FROM deko_comments c WHERE c.id = comment_id AND (
      is_event_member(c.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
      OR dl_has_tab_access(c.event_id, 'dekoration', 'read')
    )
  )
);
CREATE POLICY "deko_reply_delete" ON deko_comment_replies FOR DELETE USING (author_id = auth.uid());

-- votes
CREATE POLICY "deko_vote_select" ON deko_votes FOR SELECT USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
  OR dl_has_tab_access(event_id, 'dekoration', 'read')
);
CREATE POLICY "deko_vote_write" ON deko_votes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- budget links: veranstalter only (written by service role via API)
CREATE POLICY "deko_budget_link_select" ON deko_budget_links FOR SELECT USING (
  is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
);
CREATE POLICY "deko_budget_link_write" ON deko_budget_links FOR ALL USING (
  is_event_member(event_id, ARRAY['veranstalter']::user_role[])
) WITH CHECK (
  is_event_member(event_id, ARRAY['veranstalter']::user_role[])
);

-- ── 13. Realtime publication ─────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE deko_items;
ALTER PUBLICATION supabase_realtime ADD TABLE deko_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE deko_comment_replies;
ALTER PUBLICATION supabase_realtime ADD TABLE deko_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE deko_canvases;

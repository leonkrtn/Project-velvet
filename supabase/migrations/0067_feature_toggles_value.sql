-- Add optional text value column to feature_toggles.
-- Used for metadata like scheduled unlock dates (e.g. gaeste-fotos-unlock-at → ISO date string).
ALTER TABLE feature_toggles ADD COLUMN IF NOT EXISTS value TEXT;

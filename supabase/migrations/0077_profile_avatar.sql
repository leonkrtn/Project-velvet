-- R2-Schlüssel für Profilbilder (kein öffentlicher URL, wird per Worker presigned)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_r2_key TEXT;

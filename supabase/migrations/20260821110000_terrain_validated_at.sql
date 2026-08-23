-- validated_at manquant en prod (migration initiale non appliquée entièrement)
ALTER TABLE reservations_terrain
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

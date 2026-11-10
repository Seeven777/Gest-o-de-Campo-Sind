-- Jornada guiada v1.3: verificações factuais adicionais para a central.
-- Migração aditiva: aplicar primeiro na branch Neon de Preview, nunca sem homologação na main.
ALTER TABLE visits ADD COLUMN IF NOT EXISTS address_match text;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS pet_activity_match text;
-- Ambos permanecem nulos nas visitas anteriores; a interface mostra "Não informado".

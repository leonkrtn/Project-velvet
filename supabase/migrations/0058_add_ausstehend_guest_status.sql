-- Add 'ausstehend' to guest_status_enum
ALTER TYPE guest_status_enum ADD VALUE IF NOT EXISTS 'ausstehend';

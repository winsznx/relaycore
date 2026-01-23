-- Fix session_id auto-increment
-- The session_id column was missing a default sequence

CREATE SEQUENCE IF NOT EXISTS escrow_sessions_session_id_seq;

ALTER TABLE escrow_sessions 
ALTER COLUMN session_id SET DEFAULT nextval('escrow_sessions_session_id_seq');

-- Set the sequence to start from the next available ID
SELECT setval('escrow_sessions_session_id_seq', 
    COALESCE((SELECT MAX(session_id) FROM escrow_sessions), 0) + 1, 
    false);

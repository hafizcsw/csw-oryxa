-- Add tab and route columns to events table for ACK/event logging
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS tab text,
ADD COLUMN IF NOT EXISTS route text;
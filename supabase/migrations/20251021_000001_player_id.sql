-- Add stable player_id and remove username uniqueness so names can change
alter table public.leaderboard add column if not exists player_id text;

-- Unique index for player_id (allows multiple NULLs until set)
create unique index if not exists leaderboard_player_id_uq on public.leaderboard (player_id);

-- Drop unique constraint on username if it exists
alter table public.leaderboard drop constraint if exists leaderboard_username_key;

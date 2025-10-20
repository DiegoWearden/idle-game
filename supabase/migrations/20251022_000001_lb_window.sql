-- Rank window RPC and enable realtime for leaderboard
create or replace function public.lb_window(p_player_id text, p_window int default 2)
returns table (rank int, player_id text, username text, drops bigint)
language sql
stable
as $$
with ranked as (
  select player_id, username, drops,
         rank() over (order by drops desc, player_id asc) as r
  from public.leaderboard
), me as (
  select r from ranked where player_id = p_player_id
)
select ranked.r as rank, ranked.player_id, ranked.username, ranked.drops
from ranked, me
where ranked.r between greatest(me.r - p_window, 1) and me.r + p_window
order by ranked.r;
$$;

-- Add table to realtime publication if not already present
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

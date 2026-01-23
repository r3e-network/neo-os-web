select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'miniapps',
    'miniapp_stats',
    'miniapp_stats_daily',
    'miniapp_notifications',
    'miniapp_tx_events',
    'miniapp_stats_rollup_log',
    'social_comments',
    'social_comment_votes',
    'social_ratings',
    'social_proof_of_interaction'
  )
order by tablename;

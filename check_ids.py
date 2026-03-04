import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

print("--- Data Link Check ---")
v_res = supabase.table('videos').select('id, platform_video_id').limit(1).execute()
m_res = supabase.table('videos_niche_map').select('id, platform_video_id').limit(1).execute()

if v_res.data and m_res.data:
    v = v_res.data[0]
    m = m_res.data[0]
    print(f"Video Table: ID={v['id']}, PlatformID={v['platform_video_id']}")
    print(f"Map Table:   ID={m['id']}, PlatformID={m['platform_video_id']}")
    
    # Check if a direct match exists on platform_video_id for a sample
    sample_pid = v['platform_video_id']
    match = supabase.table('videos_niche_map').select('id').eq('platform_video_id', sample_pid).execute()
    print(f"\nDoes Video PlatformID exist in Map table? {'YES' if match.data else 'NO'}")
else:
    print("Could not fetch data samples.")

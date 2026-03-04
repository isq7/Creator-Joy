import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

print("--- Testing View Join ---")
try:
    res = supabase.table('ui_videos_view').select('*, videos!inner(llm_validated)').limit(1).execute()
    print("View join SUCCESS")
except Exception as e:
    print(f"View join FAILED: {e}")

print("\n--- Testing Map Join ---")
try:
    res = supabase.table('videos').select('*, map:videos_niche_map!inner(primary_sub_niche_id)').limit(1).execute()
    print("Map join SUCCESS")
except Exception as e:
    print(f"Map join FAILED: {e}")

print("\n--- Testing Table Data ---")
try:
    res = supabase.table('videos').select('*').eq('llm_validated', True).limit(1).execute()
    if res.data:
        print("Validated data found in videos table")
    else:
        print("No validated data (True) in videos table")
except Exception as e:
    print(f"Videos table check FAILED: {e}")

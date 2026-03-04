import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

print("--- Testing Videos -> Creators Join ---")
try:
    # Use !inner to force join
    res = supabase.table('videos').select('*, creators!inner(*)').limit(1).execute()
    print("Videos -> Creators SUCCESS")
    print("Sample:", res.data[0] if res.data else "No data")
except Exception as e:
    print(f"Videos -> Creators FAILED: {e}")

print("\n--- Testing View Definition Column Check ---")
try:
    res = supabase.table('ui_videos_view').select('*').limit(1).execute()
    print("View Columns:", res.data[0].keys() if res.data else "No data")
except Exception as e:
    print(f"View check FAILED: {e}")

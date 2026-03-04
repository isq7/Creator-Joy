import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

print("--- Testing Map to Videos Reverse Join ---")
try:
    # Try reverse join if it exists
    res = supabase.table('videos_niche_map').select('*, videos(*)').limit(1).execute()
    print("Map -> Videos SUCCESS")
except Exception as e:
    print(f"Map -> Videos FAILED: {e}")

print("\n--- Testing Select from Videos with Creator ---")
try:
    # creators usually has a relationship
    res = supabase.table('videos').select('*, creators(*)').limit(1).execute()
    print("Videos -> Creators SUCCESS")
except Exception as e:
    print(f"Videos -> Creators FAILED: {e}")

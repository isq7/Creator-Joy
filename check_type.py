import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

res = supabase.table('creator_profiles').select('primary sub niche id').limit(1).execute()
if res.data:
    val = res.data[0]['primary sub niche id']
    print(f"Value: {val}")
    print(f"Type: {type(val)}")
else:
    print("No data")

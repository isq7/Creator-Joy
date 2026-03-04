import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase = create_client(url, key)

# 1. Get a sample profile
profile_res = supabase.table('creator_profiles').select('*').limit(1).execute()
if not profile_res.data:
    print("No profiles found")
    exit()

profile = profile_res.data[0]
print(f"Testing for profile: {profile['unique_identifier']}")
print(f"Niche ID: {profile.get('niche_id')}")
print(f"Primary Sub: {profile.get('primary sub niche id')}")
print(f"Secondary Sub: {profile.get('secondary sub niche id')}")

# 2. Try the exact query fetchOutliers would run
p_id = profile.get('primary sub niche id')
s_id = profile.get('secondary sub niche id')
n_id = profile.get('niche_id')

query = supabase.table('ui_videos_view').select('count', count='exact')
if n_id:
    query = query.eq('niche_id', n_id)
if p_id:
    query = query.eq('primary_sub_niche_id', p_id)
if s_id:
    query = query.eq('secondary_sub_niche_id', s_id)

res = query.execute()
print(f"\nResults for this pair: {res.count}")

# 3. Check if any validated videos exist at all in the view
total = supabase.table('ui_videos_view').select('count', count='exact').execute()
print(f"Total validated mappings in view: {total.count}")

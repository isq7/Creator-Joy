import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    print("Missing Supabase credentials")
    exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

# Get all niches
niches_res = supabase.table("niches_list").select("niche_id, name").execute()
niches = {n["niche_id"]: n["name"] for n in niches_res.data}

print("Fetching counts per niche...")

total_niches = len(niches)
completed = 0
ongoing = 0
not_started = 0

for niche_id, name in niches.items():
    # count total videos
    total_res = supabase.table("videos").select("id", count="exact").eq("niche_id", niche_id).execute()
    total_videos = total_res.count if total_res.count else 0
    
    # count pending (llm_validated is null)
    pending_res = supabase.table("videos").select("id", count="exact").eq("niche_id", niche_id).is_("llm_validated", "null").execute()
    pending_videos = pending_res.count if pending_res.count else 0
    
    validated = total_videos - pending_videos
    
    if total_videos == 0:
        continue # skip empty niches
    
    if pending_videos == 0:
        print(f"Niche {niche_id} ({name}): COMPLETED ({validated}/{total_videos} validated)")
        completed += 1
    elif pending_videos == total_videos:
        print(f"Niche {niche_id} ({name}): NOT STARTED ({pending_videos} pending)")
        not_started += 1
    else:
        print(f"Niche {niche_id} ({name}): IN PROGRESS ({validated}/{total_videos} validated, {pending_videos} pending)")
        ongoing += 1

print("\nSummary:")
print(f"Completed: {completed}")
print(f"In Progress: {ongoing}")
print(f"Not Started: {not_started}")

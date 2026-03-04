import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not found in .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def reset_llm_validation(niche_id):
    print(f"--- Resetting llm_validated to NULL for niche_id {niche_id} ---")
    
    # 1. First, check how many rows we're talking about
    response = supabase.table("videos").select("id").eq("niche_id", niche_id).execute()
    total_rows = len(response.data)
    
    if total_rows == 0:
        print(f"No videos found for niche_id {niche_id}.")
        return

    print(f"Found {total_rows} videos to reset. Updating...")

    # 2. Update all to NULL
    # This might need to happen in chunks if it's too large, but typically it's fine for a few hundred rows.
    # We update llm_validated to null (None in Python)
    update_resp = supabase.table("videos").update({"llm_validated": None}).eq("niche_id", niche_id).execute()
    
    print(f"Successfully reset {len(update_resp.data)} rows to NULL.")

if __name__ == "__main__":
    reset_llm_validation(1)

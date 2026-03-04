from dotenv import load_dotenv
load_dotenv()
import os
import requests

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

print("Clearing subniche_pair_progress table...")

# This deletes all rows (we need a wildcard query that matches everything to delete via PostgREST)
r = requests.delete(
    f"{SUPABASE_URL}/rest/v1/subniche_pair_progress?niche_id=not.is.null", 
    headers=HEADERS
)

if r.status_code in [200, 204]:
    print("Done! Cleared the progress tracking table.")
else:
    print("Failed to clear:", r.status_code, r.text)

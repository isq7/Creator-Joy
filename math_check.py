from dotenv import load_dotenv
load_dotenv()
import os
import requests

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}

def get_total_creators():
    # Make a head request to get count, or paginate
    offset = 0
    total = 0
    while True:
        headers = HEADERS.copy()
        headers["Range"] = f"{offset}-{offset+999}"
        r = requests.get(f"{SUPABASE_URL}/rest/v1/creators_master?select=id", headers=headers)
        data = r.json()
        total += len(data)
        if len(data) < 1000:
            break
        offset += 1000
    return total

print(f"Total Unique Creators in DB: {get_total_creators()}")

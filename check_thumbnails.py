from dotenv import load_dotenv
load_dotenv()
import os
import requests
import json

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json"
}

# Check ui_videos_view for Instagram videos and their thumbnail_url
resp = requests.get(
    f"{SUPABASE_URL}/rest/v1/ui_videos_view?platform=eq.instagram&select=video_id,video_url,thumbnail_url&limit=5",
    headers=headers
)

print("=== ui_videos_view (Instagram, first 5) ===")
data = resp.json()
print(json.dumps(data, indent=2))

# Check how many have thumbnail_url populated
resp2 = requests.get(
    f"{SUPABASE_URL}/rest/v1/ui_videos_view?platform=eq.instagram&thumbnail_url=not.is.null&select=count",
    headers={**headers, "Prefer": "count=exact"},
)
print(f"\nInstagram rows WITH thumbnail_url: {resp2.headers.get('content-range', 'n/a')}")

resp3 = requests.get(
    f"{SUPABASE_URL}/rest/v1/ui_videos_view?platform=eq.instagram&thumbnail_url=is.null&select=count",
    headers={**headers, "Prefer": "count=exact"},
)
print(f"Instagram rows WITHOUT thumbnail_url: {resp3.headers.get('content-range', 'n/a')}")

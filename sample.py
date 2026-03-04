import os
import requests
import json
import re as _re
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

APIFY_TOKEN = os.getenv("APIFY_TOKEN")
# Using the Profile Reels Scraper as used in the main script
APIFY_URL = f"https://api.apify.com/v2/acts/instagram-scraper~instagram-profile-reels-scraper/run-sync-get-dataset-items?token={APIFY_TOKEN}"

apify_payload = {
    "instagramUsernames": ["backstagewithmillionaires"],
    "postsPerProfile": 12
}

print(f"Calling Apify for 1 username...")
apify_response = requests.post(
    APIFY_URL,
    headers={"Content-Type": "application/json"},
    json=apify_payload,
    timeout=300
)
if apify_response.status_code >= 400:
    print(f"ERROR {apify_response.status_code}: {apify_response.text}")
else:
    reels = apify_response.json()
    if reels:
        with open('reel_debug.json', 'w') as f:
            json.dump(reels[0], f, indent=2)
        print("Written reel_debug.json")

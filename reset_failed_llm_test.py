import os
import re
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(supabase_url, supabase_key)

LOG_FILE = "video_validation.log"
pattern = re.compile(r"\[INVALID\] Map ID ([0-9a-f\-]{36}): LLM API call failed")

failed_ids = []
with open(LOG_FILE, encoding="utf-8", errors="replace") as f:
    for line in f:
        m = pattern.search(line)
        if m:
            failed_ids.append(m.group(1))
            if len(failed_ids) >= 30:  # Only reset 30 for the test
                break

print(f"Resetting {len(failed_ids)} videos to NULL for test...")

supabase.table("videos") \
    .update({"llm_validated": None}) \
    .in_("id", failed_ids) \
    .execute()

print(f"Done! {len(failed_ids)} videos reset to NULL. Ready for test run.")

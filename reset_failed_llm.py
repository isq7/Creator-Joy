import os
import re
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

if not supabase_url or not supabase_key:
    print("Missing Supabase credentials")
    exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

# ─────────────────────────────────────────────
# Step 1: Extract all map_ids from log where
#         the reason was "LLM API call failed"
# ─────────────────────────────────────────────
LOG_FILE = "video_validation.log"

# Matches lines like:
# 2026-03-01 08:49:14,989 - INFO - [INVALID] Map ID 672b2a9d-...: LLM API call failed
pattern = re.compile(r"\[INVALID\] Map ID ([0-9a-f\-]{36}): LLM API call failed")

failed_ids = []
with open(LOG_FILE, encoding="utf-8", errors="replace") as f:
    for line in f:
        m = pattern.search(line)
        if m:
            failed_ids.append(m.group(1))

print(f"Found {len(failed_ids)} video IDs wrongly marked invalid due to LLM API failure.")

if not failed_ids:
    print("Nothing to reset. Exiting.")
    exit(0)

# ─────────────────────────────────────────────
# Step 2: Reset llm_validated → NULL in batches
# ─────────────────────────────────────────────
BATCH_SIZE = 400
total_reset = 0

for i in range(0, len(failed_ids), BATCH_SIZE):
    batch = failed_ids[i:i + BATCH_SIZE]
    try:
        supabase.table("videos") \
            .update({"llm_validated": None}) \
            .in_("id", batch) \
            .execute()
        total_reset += len(batch)
        print(f"Reset {total_reset}/{len(failed_ids)}...")
    except Exception as e:
        print(f"ERROR on batch {i // BATCH_SIZE + 1}: {e}")

print(f"\nDone! {total_reset} videos reset to NULL. The validator will re-process them on next run.")

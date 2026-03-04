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

def clear_table(table_name, wildcard_col="platform"):
    print(f"Clearing [{table_name}] table...")
    # Using a wildcard that is true for all rows to bypass Supabase's mandatory query-on-delete restriction
    r = requests.delete(
        f"{SUPABASE_URL}/rest/v1/{table_name}?{wildcard_col}=not.is.null", 
        headers=HEADERS
    )
    if r.status_code in [200, 204]:
        print(f"   -> Successfully wiped {table_name}")
    else:
        print(f"   -> Failed to wipe {table_name}:", r.status_code, r.text)

def main():
    print("WARNING: This will completely wipe the existing video databases.")
    # Wipe the mapping table first (in case of foreign key constraints)
    clear_table("videos_niche_map", "platform")
    # Wipe the primary videos table second
    clear_table("videos", "platform")
    # Wipe the progress tracker again just so the script starts totally fresh
    clear_table("subniche_pair_progress", "niche_id")
    print("Database cleanup complete. You can now run Final_Weekly_Scraper.py!")

if __name__ == "__main__":
    main()

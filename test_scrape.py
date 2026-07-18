import os, requests
from dotenv import load_dotenv

load_dotenv("agent/.env")
api_key = os.getenv("BRIGHTDATA_API_KEY")

resp = requests.post(
    "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_l7q7dkf244hwjntr0&format=json",
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
    json=[{"url": "https://www.amazon.com/s?k=Advil"}],
)
print("Status:", resp.status_code)
print("Data:", resp.json())

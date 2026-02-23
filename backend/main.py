import asyncio
import json
import logging
from datetime import date
from io import BytesIO

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
APIFY_TOKEN = os.getenv("APIFY_TOKEN")
APIFY_ACTOR_ID = "jupri~airbnb"


@app.get("/")
async def health():
    return {"status": "ok"}


async def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    """Transcribe audio using OpenAI Whisper."""
    transcript = await client.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, audio_bytes),
    )
    return transcript.text


async def extract_search_params(transcript: str) -> dict:
    """Use GPT-4o-mini to extract structured search params from transcript."""
    today = date.today().isoformat()

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": f"""You are a travel search assistant. Extract Airbnb search parameters from the user's spoken request.

Today's date is {today}. Use this to resolve relative dates like "next weekend", "this Friday", "in two weeks", etc.

Return a JSON object with exactly these fields:
- "location" (string, required): The destination city, region, or area. Be specific.
- "check_in" (string or null): Check-in date in YYYY-MM-DD format. Null if not mentioned.
- "check_out" (string or null): Check-out date in YYYY-MM-DD format. Null if not mentioned.
- "adults" (integer): Number of adult guests. Default 1 if not mentioned.
- "children" (integer): Number of children (ages 2-12). Default 0.
- "infants" (integer): Number of infants (under 2). Default 0.
- "currency" (string): Currency code (e.g. USD, EUR, GBP, TRY). Default "USD".
- "maxListings" (integer): How many results to return. Default 10.

If the user mentions a duration (e.g., "3 nights", "a week"), calculate check_out from check_in + duration.
If only a vague time is mentioned (e.g., "this summer"), pick reasonable dates.
If no dates at all, set both to null.

Only return the JSON object, nothing else.""",
            },
            {"role": "user", "content": transcript},
        ],
    )

    return json.loads(response.choices[0].message.content)


async def run_airbnb_scraper(params: dict) -> list[dict]:
    """Run the Apify Airbnb scraper and return normalized listings."""
    actor_input: dict = {
        "location": [params.get("location", "")],
        "limit": params.get("maxListings", 10),
    }

    if params.get("check_in"):
        actor_input["check_in"] = params["check_in"]
    if params.get("check_out"):
        actor_input["check_out"] = params["check_out"]
    if params.get("adults"):
        actor_input["adults"] = params["adults"]
    if params.get("children"):
        actor_input["children"] = params["children"]
    if params.get("infants"):
        actor_input["infants"] = params["infants"]
    if params.get("currency"):
        actor_input["currency"] = params["currency"]

    logger.info(f"Apify actor input: {json.dumps(actor_input, indent=2)}")

    async with httpx.AsyncClient(timeout=300) as http:
        # Use the sync endpoint that waits for completion and returns dataset items directly
        response = await http.post(
            f"https://api.apify.com/v2/acts/{APIFY_ACTOR_ID}/run-sync-get-dataset-items",
            params={"token": APIFY_TOKEN},
            json=actor_input,
        )

        logger.info(f"Apify sync response status: {response.status_code}")

        if response.status_code not in (200, 201):
            logger.error(f"Apify error body: {response.text[:500]}")
            raise HTTPException(
                status_code=502,
                detail=f"Apify actor failed: {response.text[:200]}",
            )

        raw_listings = response.json()

        logger.info(f"Apify returned {len(raw_listings)} items")
        if raw_listings:
            logger.info(f"First item keys: {list(raw_listings[0].keys())}")
            logger.info(f"First item sample: {json.dumps(raw_listings[0], indent=2, default=str)[:1500]}")

    return normalize_listings(raw_listings)


def normalize_listings(raw: list[dict]) -> list[dict]:
    """Normalize raw Apify output into a clean format."""
    listings = []
    for item in raw:
        # Extract first image from picture.contextual[0].url
        image = None
        picture = item.get("picture") or {}
        contextual = picture.get("contextual") or []
        if contextual and isinstance(contextual[0], dict):
            image = contextual[0].get("url")

        # Extract price from pricing.quote
        price_display = None
        per_night = None
        pricing = item.get("pricing") or {}
        quote = pricing.get("quote") or {}
        primary = quote.get("primary") or {}
        price_display = primary.get("description")  # e.g. "$148 for 3 nights"
        # Try to get per-night from details
        details = quote.get("details") or []
        if details:
            per_night = details[0].get("description")  # e.g. "3 nights x $49.00"

        listing = {
            "name": item.get("name") or item.get("title") or "Unnamed listing",
            "url": item.get("url") or f"https://www.airbnb.com/rooms/{item.get('id', '')}",
            "priceTotal": price_display,
            "pricePerNight": per_night,
            "rating": item.get("rating"),
            "reviewCount": item.get("reviewsCount") or 0,
            "image": image,
            "type": item.get("spaceType") or item.get("roomType") or "",
            "location": item.get("city") or "",
            "badges": item.get("badges") or [],
            "bedrooms": item.get("bedrooms"),
            "beds": item.get("beds"),
            "bathrooms": item.get("bathrooms"),
            "capacity": item.get("capacity"),
            "superhost": item.get("superhost", False),
        }
        listings.append(listing)
    return listings


@app.post("/api/search")
async def search(audio: UploadFile = File(...)):
    """Full pipeline: transcribe -> extract params -> scrape Airbnb."""
    audio_bytes = await audio.read()
    filename = audio.filename or "recording.webm"

    # Step 1: Transcribe
    transcript = await transcribe_audio(audio_bytes, filename)

    # Step 2: Extract search parameters
    search_params = await extract_search_params(transcript)

    # Step 3: Run Airbnb scraper
    try:
        listings = await run_airbnb_scraper(search_params)
    except HTTPException as e:
        logger.error(f"Apify scraper failed: {e.detail}")
        listings = []
    except Exception as e:
        logger.error(f"Unexpected error in scraper: {e}")
        listings = []

    return {
        "transcript": transcript,
        "searchParams": search_params,
        "listings": listings,
    }

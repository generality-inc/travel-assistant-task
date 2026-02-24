import asyncio
import hashlib
import json
import logging
import time
from datetime import date

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
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

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
APIFY_TOKEN = os.getenv("APIFY_TOKEN")
APIFY_ACTOR_ID = "jupri~airbnb"


@app.get("/")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Realtime API: ephemeral token
# ---------------------------------------------------------------------------

PROPERTY_TYPES_ENUM = ["1", "2", "3", "4"]
PROPERTY_TYPES_DESC = "Property type IDs: 1=House, 2=Guest House, 3=Apartment, 4=Hotel"

ROOM_TYPES_ENUM = ["entire-home", "private-room", "shared-room"]

SPECIES_ENUM = [
    "56", "1", "57", "3", "8", "43", "38", "70", "4", "32", "58", "54",
    "5", "18", "22", "59", "37", "60", "61", "62", "17", "9", "23", "63",
    "53", "40", "51", "75", "45", "42", "2", "64", "24", "12", "52", "19",
    "71", "10", "35", "48", "44", "50", "28", "55", "74", "76", "65", "78",
    "49", "47", "66", "79", "34", "46", "67", "16", "77", "36", "25", "6",
    "68", "39", "11", "69", "15",
]
SPECIES_DESC = (
    "Unique stay type IDs: 1=Apartment, 2=House, 3=B&B, 4=Cabin, 5=Castle, "
    "6=Treehouse, 8=Boat, 9=Dorm, 10=Lighthouse, 11=Villa, 12=Igloo, "
    "15=Yurt, 16=Tipi, 17=Dome house, 18=Cave, 19=Island, 22=Chalet, "
    "23=Earth house, 24=Hut, 25=Train, 28=Plane, 32=Camper/RV, "
    "34=Tent, 35=Loft, 36=Townhouse, 37=Condominium, 38=Bungalow, "
    "39=Vacation home, 40=Guesthouse, 42=Hotel, 43=Boutique hotel, "
    "44=Nature lodge, 45=Hostel, 46=Timeshare, 47=Serviced apartment, "
    "48=Minsu, 49=Ryokan, 50=Pension, 51=Heritage hotel, 52=In-law, "
    "53=Guest suite, 54=Casa particular, 55=Pousada, 56=Aparthotel, "
    "57=Barn, 58=Campsite, 59=Condohotel, 60=Cycladic house, "
    "61=Dammuso, 62=Dome, 63=Farm stay, 64=Houseboat, "
    "65=Resort, 66=Shepherd's hut, 67=Tiny house, 68=Trullo, "
    "69=Windmill, 70=Bus, 71=Kezhan, 74=Ranch, 75=Holiday park, "
    "76=Religious building, 77=Tower, 78=Riad, 79=Shipping container"
)

HOME_AMENITIES_ENUM = [
    "pool", "hot-tub", "free-parking", "ev-charger", "crib",
    "gym", "bbq-grill", "breakfast", "fireplace", "smoking",
]

HOME_ESSENTIALS_ENUM = [
    "wifi", "kitchen", "washer", "dryer", "ac",
    "heating", "workspace", "tv", "hair-dryer", "iron",
]

HOME_SAFETY_ENUM = ["smoke-alarm", "co-alarm"]

ACCESSIBILITY_ENTRANCE_ENUM = ["110", "111", "112", "114"]
ACCESSIBILITY_ENTRANCE_DESC = "110=Step-free entrance, 111=Entrance wider than 32in, 112=Step-free path, 114=Accessible parking"

ACCESSIBILITY_BEDROOM_ENUM = ["115", "116"]
ACCESSIBILITY_BEDROOM_DESC = "115=Step-free bedroom, 116=Bedroom entrance wider than 32in"

ACCESSIBILITY_BATHROOM_ENUM = ["120", "121", "294", "295", "296", "297"]
ACCESSIBILITY_BATHROOM_DESC = "120=Step-free bathroom, 121=Bathroom wider than 32in, 294=Shower grab bar, 295=Toilet grab bar, 296=Step-free shower, 297=Shower chair"

LOCATION_TAGS_ENUM = ["789", "686"]
LOCATION_TAGS_DESC = "789=Beachfront, 686=Waterfront"


@app.get("/api/token")
async def get_realtime_token():
    """Create an ephemeral key for the OpenAI Realtime API."""
    today = date.today().isoformat()

    async with httpx.AsyncClient() as http:
        response = await http.post(
            "https://api.openai.com/v1/realtime/sessions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-realtime-1.5",
                "modalities": ["text"],
                "instructions": (
                    f"You are a travel search assistant. Today's date is {today}. "
                    "Your ONLY job is to call the search_airbnb function whenever the user mentions travel intent. "
                    "Call it immediately when you have at least a location. "
                    "When the user refines their request, call search_airbnb again with all accumulated parameters updated. "
                    "Keep searches broad by default — only set filters the user explicitly asks for. "
                    "Never respond with text or speech. Only call the function."
                ),
                "tools": [
                    {
                        "type": "function",
                        "name": "search_airbnb",
                        "description": "Search for Airbnb listings. Call whenever user provides or updates travel requirements.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "location": {
                                    "type": "string",
                                    "description": "Destination city, neighborhood, or area",
                                },
                                "check_in": {
                                    "type": "string",
                                    "description": "Check-in date YYYY-MM-DD",
                                },
                                "check_out": {
                                    "type": "string",
                                    "description": "Check-out date YYYY-MM-DD",
                                },
                                "adults": {
                                    "type": "integer",
                                    "description": "Adult guests (13+)",
                                    "default": 1,
                                },
                                "children": {
                                    "type": "integer",
                                    "description": "Children (2-12)",
                                    "default": 0,
                                },
                                "infants": {
                                    "type": "integer",
                                    "description": "Infants (under 2)",
                                    "default": 0,
                                },
                                "pets": {
                                    "type": "integer",
                                    "description": "Number of pets",
                                    "default": 0,
                                },
                                "currency": {
                                    "type": "string",
                                    "description": "Currency code (USD, EUR, GBP, etc.)",
                                    "default": "USD",
                                },
                                "limit": {
                                    "type": "integer",
                                    "description": "Number of results",
                                    "default": 10,
                                },
                                # Type of place
                                "room_types": {
                                    "type": "array",
                                    "items": {"type": "string", "enum": ROOM_TYPES_ENUM},
                                    "description": "Type of place: entire-home, private-room, shared-room",
                                },
                                "types": {
                                    "type": "array",
                                    "items": {"type": "string", "enum": PROPERTY_TYPES_ENUM},
                                    "description": PROPERTY_TYPES_DESC,
                                },
                                "species": {
                                    "type": "array",
                                    "items": {"type": "string", "enum": SPECIES_ENUM},
                                    "description": SPECIES_DESC,
                                },
                                # Price
                                "min_price": {
                                    "type": "integer",
                                    "description": "Min price per night",
                                },
                                "max_price": {
                                    "type": "integer",
                                    "description": "Max price per night",
                                },
                                "discounted": {
                                    "type": "boolean",
                                    "description": "Only show discounted stays",
                                },
                                # Quality badges
                                "superhost": {
                                    "type": "boolean",
                                    "description": "Superhost only — highly rated trusted hosts",
                                },
                                "airbnb_plus": {
                                    "type": "boolean",
                                    "description": "Airbnb Plus — verified for quality and design",
                                },
                                "airbnb_luxe": {
                                    "type": "boolean",
                                    "description": "Airbnb Luxe — handpicked luxury homes with services",
                                },
                                "guest_fav": {
                                    "type": "boolean",
                                    "description": "Guest Favorite — most loved homes according to guests",
                                },
                                "work_trip": {
                                    "type": "boolean",
                                    "description": "Suitable for work trips",
                                },
                                # Booking
                                "instant_book": {
                                    "type": "boolean",
                                    "description": "Instant book without host approval",
                                },
                                "free_cancel": {
                                    "type": "boolean",
                                    "description": "Free cancellation",
                                },
                                "amenities.self_checkin": {
                                    "type": "boolean",
                                    "description": "Self check-in available",
                                },
                                # Rooms
                                "bedrooms": {
                                    "type": "integer",
                                    "description": "Minimum bedrooms",
                                },
                                "beds": {
                                    "type": "integer",
                                    "description": "Minimum beds",
                                },
                                "bathrooms": {
                                    "type": "integer",
                                    "description": "Minimum bathrooms",
                                },
                                # Amenities
                                "home_amenities": {
                                    "type": "array",
                                    "items": {"type": "string", "enum": HOME_AMENITIES_ENUM},
                                    "description": "Amenities: pool, hot-tub, free-parking, ev-charger, crib, gym, bbq-grill, breakfast, fireplace, smoking",
                                },
                                "home_essential": {
                                    "type": "array",
                                    "items": {"type": "string", "enum": HOME_ESSENTIALS_ENUM},
                                    "description": "Essentials: wifi, kitchen, washer, dryer, ac, heating, workspace, tv, hair-dryer, iron",
                                },
                                "home_safety": {
                                    "type": "array",
                                    "items": {"type": "string", "enum": HOME_SAFETY_ENUM},
                                    "description": "Safety: smoke-alarm, co-alarm",
                                },
                                # Location tags
                                "tags": {
                                    "type": "array",
                                    "items": {"type": "string", "enum": LOCATION_TAGS_ENUM},
                                    "description": LOCATION_TAGS_DESC,
                                },
                                # Accessibility
                                "home_access": {
                                    "type": "array",
                                    "items": {"type": "string", "enum": ACCESSIBILITY_ENTRANCE_ENUM},
                                    "description": ACCESSIBILITY_ENTRANCE_DESC,
                                },
                                "bedroom_amenities": {
                                    "type": "array",
                                    "items": {"type": "string", "enum": ACCESSIBILITY_BEDROOM_ENUM},
                                    "description": ACCESSIBILITY_BEDROOM_DESC,
                                },
                                "bathroom_amenities": {
                                    "type": "array",
                                    "items": {"type": "string", "enum": ACCESSIBILITY_BATHROOM_ENUM},
                                    "description": ACCESSIBILITY_BATHROOM_DESC,
                                },
                                # Reviews
                                "reviews_count": {
                                    "type": "integer",
                                    "description": "Minimum number of visible reviews",
                                },
                            },
                            "required": ["location"],
                        },
                    }
                ],
                "tool_choice": "auto",
                "input_audio_transcription": {
                    "model": "whisper-1",
                },
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 500,
                },
            },
        )

        logger.info(f"Realtime session response: {response.status_code}")

        if response.status_code != 200:
            logger.error(f"Realtime session error: {response.text[:500]}")
            raise HTTPException(
                status_code=502,
                detail=f"Failed to create realtime session: {response.text[:200]}",
            )

        data = response.json()
        return {
            "client_secret": data["client_secret"]["value"],
            "expires_at": data["client_secret"]["expires_at"],
        }


# ---------------------------------------------------------------------------
# Search by structured params (called from frontend after tool call)
# ---------------------------------------------------------------------------

class SearchParams(BaseModel):
    location: str
    check_in: str | None = None
    check_out: str | None = None
    adults: int = 1
    children: int = 0
    infants: int = 0
    pets: int = 0
    currency: str = "USD"
    limit: int = 10
    # Type
    room_types: list[str] | None = None
    types: list[str] | None = None
    species: list[str] | None = None
    # Price
    min_price: int | None = None
    max_price: int | None = None
    discounted: bool | None = None
    # Quality
    superhost: bool | None = None
    airbnb_plus: bool | None = None
    airbnb_luxe: bool | None = None
    guest_fav: bool | None = None
    work_trip: bool | None = None
    # Booking
    instant_book: bool | None = None
    free_cancel: bool | None = None
    self_checkin: bool | None = None
    # Rooms
    bedrooms: int | None = None
    beds: int | None = None
    bathrooms: int | None = None
    # Amenities
    home_amenities: list[str] | None = None
    home_essential: list[str] | None = None
    home_safety: list[str] | None = None
    # Location
    tags: list[str] | None = None
    # Accessibility
    home_access: list[str] | None = None
    bedroom_amenities: list[str] | None = None
    bathroom_amenities: list[str] | None = None
    # Reviews
    reviews_count: int | None = None

    class Config:
        # Allow "amenities.self_checkin" field name from the LLM
        populate_by_name = True


# ---------------------------------------------------------------------------
# Result cache: location-based, 1 hour TTL
# ---------------------------------------------------------------------------

CACHE_TTL = 3600  # 1 hour
_cache: dict[str, tuple[float, list[dict]]] = {}  # key -> (timestamp, listings)


def make_cache_key(params: dict) -> str:
    """Hash all search params so identical searches hit cache."""
    # Sort keys for deterministic hashing
    canonical = json.dumps(params, sort_keys=True, default=str)
    return hashlib.md5(canonical.encode()).hexdigest()


def get_cached(params: dict) -> list[dict] | None:
    key = make_cache_key(params)
    if key in _cache:
        ts, listings = _cache[key]
        if time.time() - ts < CACHE_TTL:
            logger.info(f"[cache] HIT {params.get('location')} ({len(listings)} items, key={key[:8]})")
            return listings
        del _cache[key]
    logger.info(f"[cache] MISS {params.get('location')} (key={key[:8]})")
    return None


def set_cached(params: dict, listings: list[dict]):
    key = make_cache_key(params)
    logger.info(f"[cache] WRITE {params.get('location')} ({len(listings)} items, key={key[:8]})")
    _cache[key] = (time.time(), listings)


# ---------------------------------------------------------------------------
# Search endpoint — streaming SSE with incremental results
# ---------------------------------------------------------------------------

PASSTHROUGH_FIELDS = {
    "check_in", "check_out", "adults", "children", "infants", "pets",
    "currency", "room_types", "types", "species",
    "min_price", "max_price", "discounted",
    "superhost", "airbnb_plus", "airbnb_luxe", "guest_fav", "work_trip",
    "instant_book", "free_cancel",
    "bedrooms", "beds", "bathrooms",
    "home_amenities", "home_essential", "home_safety",
    "tags", "home_access", "bedroom_amenities", "bathroom_amenities",
    "reviews_count",
}

OVER_FETCH_LIMIT = 20  # fetch more than requested for caching


def build_actor_input(params: dict) -> dict:
    actor_input: dict = {
        "location": [params.get("location", "")],
        "limit": max(params.get("limit", 10), OVER_FETCH_LIMIT),
    }
    for field in PASSTHROUGH_FIELDS:
        val = params.get(field)
        if val is not None and val != 0 and val != [] and val is not False:
            actor_input[field] = val
    if params.get("self_checkin"):
        actor_input["amenities.self_checkin"] = True
    return actor_input


@app.post("/api/search-params")
async def search_by_params(params: SearchParams):
    """Stream listings as SSE. Returns cached results instantly if available,
    otherwise starts async Apify run and streams results as they arrive."""
    params_dict = params.model_dump(exclude_none=True)

    # Check cache — exact param match returns instantly
    cached = get_cached(params_dict)
    if cached:
        return StreamingResponse(
            _stream_cached(cached),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # Cache miss — start async Apify run and stream results
    return StreamingResponse(
        _stream_apify(params_dict),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _stream_cached(listings: list[dict]):
    """Yield cached listings as SSE events."""
    for listing in listings:
        yield f"data: {json.dumps(listing)}\n\n"
    yield f"data: {json.dumps({'__done': True, 'total': len(listings)})}\n\n"


async def _stream_apify(params: dict):
    """Start async Apify run, poll dataset, yield new items as SSE."""
    actor_input = build_actor_input(params)
    logger.info(f"Apify actor input: {json.dumps(actor_input, indent=2)}")

    all_normalized: list[dict] = []

    try:
        async with httpx.AsyncClient(timeout=300) as http:
            # Start async run
            run_res = await http.post(
                f"https://api.apify.com/v2/acts/{APIFY_ACTOR_ID}/runs",
                params={"token": APIFY_TOKEN},
                json=actor_input,
            )

            if run_res.status_code != 201:
                logger.error(f"Apify run start failed: {run_res.text[:300]}")
                yield f"data: {json.dumps({'__error': 'Failed to start search'})}\n\n"
                return

            run_id = run_res.json()["data"]["id"]
            dataset_id = run_res.json()["data"]["defaultDatasetId"]
            logger.info(f"Apify run started: {run_id}")

            offset = 0
            max_polls = 60  # ~3 minutes max

            for _ in range(max_polls):
                await asyncio.sleep(3)

                # Poll dataset items + run status in parallel
                items_req = http.get(
                    f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                    params={"token": APIFY_TOKEN, "offset": offset, "limit": 100},
                )
                status_req = http.get(
                    f"https://api.apify.com/v2/actor-runs/{run_id}",
                    params={"token": APIFY_TOKEN},
                )
                items_res, status_res = await asyncio.gather(items_req, status_req)

                # Process new items
                if items_res.status_code == 200:
                    raw_items = items_res.json()
                    if raw_items:
                        new_listings = normalize_listings(raw_items)
                        all_normalized.extend(new_listings)
                        offset += len(raw_items)
                        logger.info(f"Streaming {len(new_listings)} new items (total: {offset})")

                        # Cache incrementally so aborted streams still populate cache
                        set_cached(params, all_normalized)

                        for listing in new_listings:
                            yield f"data: {json.dumps(listing)}\n\n"

                # Check run status
                run_status = status_res.json()["data"]["status"]

                if run_status == "SUCCEEDED":
                    # Fetch any remaining items
                    final_res = await http.get(
                        f"https://api.apify.com/v2/datasets/{dataset_id}/items",
                        params={"token": APIFY_TOKEN, "offset": offset, "limit": 100},
                    )
                    if final_res.status_code == 200:
                        remaining = final_res.json()
                        if remaining:
                            final_listings = normalize_listings(remaining)
                            all_normalized.extend(final_listings)
                            for listing in final_listings:
                                yield f"data: {json.dumps(listing)}\n\n"
                    # Final cache write with all results
                    set_cached(params, all_normalized)
                    break
                elif run_status in ("FAILED", "ABORTED", "TIMED-OUT"):
                    logger.error(f"Apify run {run_status}")
                    # Cache whatever we got
                    if all_normalized:
                        set_cached(params, all_normalized)
                    yield f"data: {json.dumps({'__error': f'Search {run_status.lower()}'})}\n\n"
                    break

    except Exception as e:
        logger.error(f"Streaming error: {e}")
        yield f"data: {json.dumps({'__error': str(e)})}\n\n"

    yield f"data: {json.dumps({'__done': True, 'total': len(all_normalized)})}\n\n"


def normalize_listings(raw: list[dict]) -> list[dict]:
    """Normalize raw Apify output into a clean format."""
    listings = []
    for item in raw:
        image = None
        picture = item.get("picture") or {}
        contextual = picture.get("contextual") or []
        if contextual and isinstance(contextual[0], dict):
            image = contextual[0].get("url")

        pricing = item.get("pricing") or {}
        quote = pricing.get("quote") or {}
        primary = quote.get("primary") or {}
        price = primary.get("price")
        original_price = primary.get("original")
        qualifier = primary.get("qualifier")

        listing = {
            "name": item.get("name") or item.get("title") or "Unnamed listing",
            "url": item.get("url") or f"https://www.airbnb.com/rooms/{item.get('id', '')}",
            "price": int(price.replace(",", "")) if price else None,
            "originalPrice": int(original_price.replace(",", "")) if original_price else None,
            "qualifier": qualifier,
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

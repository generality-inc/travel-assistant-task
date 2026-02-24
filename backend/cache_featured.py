"""Fetch real Airbnb listings from interesting CA locations and cache them."""

import asyncio
import json
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv()

APIFY_TOKEN = os.getenv("APIFY_TOKEN")
APIFY_ACTOR_ID = "jupri~airbnb"

CA_LOCATIONS = [
    "Big Sur, California",
    "Joshua Tree, California",
    "Lake Tahoe, California",
    "Malibu, California",
    "Napa Valley, California",
    "Palm Springs, California",
    "San Francisco, California",
    "Santa Barbara, California",
    "Carmel-by-the-Sea, California",
    "Yosemite, California",
]

LISTINGS_PER_LOCATION = 4
OUTPUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "public", "featured.json"
)


def normalize_listing(item: dict) -> dict:
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

    return {
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


async def main():
    print(f"Fetching listings from {len(CA_LOCATIONS)} CA locations...")
    print(f"Locations: {', '.join(CA_LOCATIONS)}")

    async with httpx.AsyncClient(timeout=300) as http:
        response = await http.post(
            f"https://api.apify.com/v2/acts/{APIFY_ACTOR_ID}/run-sync-get-dataset-items",
            params={"token": APIFY_TOKEN},
            json={
                "location": CA_LOCATIONS,
                "limit": LISTINGS_PER_LOCATION,
                "currency": "USD",
            },
        )

        if response.status_code not in (200, 201):
            print(f"Error: {response.status_code} {response.text[:300]}")
            sys.exit(1)

        raw = response.json()
        print(f"Got {len(raw)} raw listings")

    normalized = [normalize_listing(item) for item in raw]

    # Filter out listings without images and deduplicate by URL
    seen_urls: set[str] = set()
    with_images = []
    for l in normalized:
        if l["image"] and l["url"] not in seen_urls:
            seen_urls.add(l["url"])
            with_images.append(l)
    print(f"Listings with images: {len(with_images)}")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(with_images, f, indent=2)

    print(f"Cached {len(with_images)} listings to {OUTPUT_PATH}")
    for l in with_images:
        print(f"  - {l['name']} ({l['location']}) ${l['price'] or '?'}")


if __name__ == "__main__":
    asyncio.run(main())

# Voice-Powered Travel Search

Build a voice-driven travel search application that lets users find Airbnb listings by speaking naturally.

## Overview

Create a web application where users can describe their ideal trip using their voice, and see matching Airbnb listings appear in real time. The application should feel conversational — users start with a broad request like "I want to visit Tokyo" and progressively refine by speaking additional criteria like "somewhere near Shibuya", "for 4 guests", or "with a pool".

The UI should follow a similar design language to Airbnb's listing dashboard:

![Airbnb Dashboard](airbnb-dashboard.png)

## Core Requirements

- A frontend (framework of your choice) with a voice input interface
- A backend that orchestrates between OpenAI and an Airbnb data source
- Real-time or near-real-time listing updates as the user speaks

## Services

**OpenAI** — Use any combination of OpenAI APIs (Whisper, Chat Completions, Realtime API, etc.) to handle speech-to-text and natural language understanding. The system should interpret user intent and translate it into structured search parameters.

**Airbnb Data** — Use the Airbnb Scraper actor on Apify (actor ID: `tri_angle/airbnb-scraper`, `https://api.apify.com/v2/actors/GsNzxEKzE2vQ5d9HN/`) to fetch listings. The actor accepts filters like location, dates, guest count, price range, amenities, property type, and more. See the actor's input schema for the full set of available filters.

## What We're Looking For

- **Architecture decisions** — How do you connect voice input to search? How do you handle the latency of scraping? What tradeoffs did you make?
- **User experience** — The scraper is slow (30-90s). How do you make the experience feel responsive despite this? How does the UI communicate progress?
- **Conversational refinement** — Users should be able to iteratively narrow their search without starting over. "Make it cheaper", "only entire homes", "closer to the beach" should all work.
- **Code quality** — Clean, readable code. Reasonable error handling. No over-engineering.

## API Keys

You are given:

- `OPENAI_API_KEY`
- `APIFY_TOKEN`

## Deliverable

Run `pnpm build` and `pnpm start`, include the link on your submission link.

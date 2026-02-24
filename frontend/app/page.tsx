"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AudioVisualizer from "./components/AudioVisualizer";
import ListingGrid from "./components/ListingGrid";
import type { Listing } from "./components/ListingCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ease = [0.23, 1, 0.32, 1] as const;

interface SearchParams {
  location: string;
  check_in?: string | null;
  check_out?: string | null;
  adults?: number;
  children?: number;
  infants?: number;
  pets?: number;
  currency?: string;
  limit?: number;
  room_types?: string[];
  types?: string[];
  species?: string[];
  min_price?: number;
  max_price?: number;
  discounted?: boolean;
  superhost?: boolean;
  airbnb_plus?: boolean;
  airbnb_luxe?: boolean;
  guest_fav?: boolean;
  work_trip?: boolean;
  instant_book?: boolean;
  free_cancel?: boolean;
  self_checkin?: boolean;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  home_amenities?: string[];
  home_essential?: string[];
  home_safety?: string[];
  tags?: string[];
  home_access?: string[];
  bedroom_amenities?: string[];
  bathroom_amenities?: string[];
  reviews_count?: number;
  [key: string]: unknown;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  "entire-home": "Entire place",
  "private-room": "Private room",
  "shared-room": "Shared room",
};

const SPECIES_LABELS: Record<string, string> = {
  "1": "Apartment", "2": "House", "3": "B&B", "4": "Cabin", "5": "Castle",
  "6": "Treehouse", "8": "Boat", "9": "Dorm", "10": "Lighthouse", "11": "Villa",
  "12": "Igloo", "15": "Yurt", "16": "Tipi", "17": "Dome", "18": "Cave",
  "19": "Island", "22": "Chalet", "24": "Hut", "25": "Train", "28": "Plane",
  "32": "Camper/RV", "34": "Tent", "35": "Loft", "36": "Townhouse",
  "37": "Condo", "38": "Bungalow", "40": "Guesthouse", "42": "Hotel",
  "43": "Boutique hotel", "44": "Nature lodge", "45": "Hostel",
  "53": "Guest suite", "56": "Aparthotel", "57": "Barn", "58": "Campsite",
  "63": "Farm stay", "64": "Houseboat", "65": "Resort", "67": "Tiny house",
  "68": "Trullo", "69": "Windmill", "70": "Bus", "74": "Ranch",
  "76": "Religious building", "77": "Tower", "78": "Riad", "79": "Container",
};

const TAG_LABELS: Record<string, string> = { "789": "Beachfront", "686": "Waterfront" };

const AMENITY_LABELS: Record<string, string> = {
  "pool": "Pool", "hot-tub": "Hot tub", "free-parking": "Free parking",
  "ev-charger": "EV charger", "crib": "Crib", "gym": "Gym",
  "bbq-grill": "BBQ", "breakfast": "Breakfast", "fireplace": "Fireplace",
  "smoking": "Smoking allowed",
};

const ESSENTIAL_LABELS: Record<string, string> = {
  "wifi": "WiFi", "kitchen": "Kitchen", "washer": "Washer", "dryer": "Dryer",
  "ac": "A/C", "heating": "Heating", "workspace": "Workspace", "tv": "TV",
  "hair-dryer": "Hair dryer", "iron": "Iron",
};

function paramBadges(p: SearchParams): string[] {
  const b: string[] = [p.location];

  if (p.check_in) b.push(`${p.check_in} → ${p.check_out || "?"}`);
  if ((p.adults ?? 0) > 1) b.push(`${p.adults} adults`);
  if ((p.children ?? 0) > 0) b.push(`${p.children} children`);
  if ((p.infants ?? 0) > 0) b.push(`${p.infants} infants`);
  if ((p.pets ?? 0) > 0) b.push(`${p.pets} pets`);

  // Type
  p.room_types?.forEach((t) => b.push(ROOM_TYPE_LABELS[t] || t));
  p.species?.forEach((s) => b.push(SPECIES_LABELS[s] || `Type ${s}`));

  // Price
  if (p.min_price != null && p.max_price != null) b.push(`$${p.min_price}–$${p.max_price}/night`);
  else if (p.min_price != null) b.push(`$${p.min_price}+ /night`);
  else if (p.max_price != null) b.push(`Under $${p.max_price}/night`);
  if (p.discounted) b.push("Discounted");

  // Quality
  if (p.superhost) b.push("Superhost");
  if (p.airbnb_plus) b.push("Airbnb Plus");
  if (p.airbnb_luxe) b.push("Luxe");
  if (p.guest_fav) b.push("Guest favorite");
  if (p.work_trip) b.push("Work trip");

  // Booking
  if (p.instant_book) b.push("Instant book");
  if (p.free_cancel) b.push("Free cancellation");
  if (p.self_checkin) b.push("Self check-in");

  // Rooms
  if (p.bedrooms != null) b.push(`${p.bedrooms}+ bedrooms`);
  if (p.beds != null) b.push(`${p.beds}+ beds`);
  if (p.bathrooms != null) b.push(`${p.bathrooms}+ baths`);

  // Amenities
  p.home_amenities?.forEach((a) => b.push(AMENITY_LABELS[a] || a));
  p.home_essential?.forEach((a) => b.push(ESSENTIAL_LABELS[a] || a));

  // Location tags
  p.tags?.forEach((t) => b.push(TAG_LABELS[t] || t));

  // Reviews
  if (p.reviews_count != null) b.push(`${p.reviews_count}+ reviews`);

  return b;
}

type VoiceStatus = "idle" | "connecting" | "connected" | "error";

export default function Home() {
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [isListening, setIsListening] = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [searchParams, setSearchParams] = useState<SearchParams | null>({
    location: "California",
  });
  const [listings, setListings] = useState<Listing[]>([]);
  const [staleListings, setStaleListings] = useState<Listing[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const handleToolCallRef = useRef<(callId: string, name: string, args: string) => void>(null);

  // Load cached featured listings + enumerate mic devices
  useEffect(() => {
    fetch("/featured.json")
      .then((r) => r.json())
      .then((data: Listing[]) => setListings(data))
      .catch(() => {});

    async function loadDevices() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        const all = await navigator.mediaDevices.enumerateDevices();
        const inputs = all.filter((d) => d.kind === "audioinput");
        setDevices(inputs);
        if (inputs.length > 0) setSelectedDeviceId(inputs[0].deviceId);
      } catch {}
    }
    loadDevices();
  }, []);

  // Tool call handler (use ref to avoid stale closures)
  handleToolCallRef.current = async (callId: string, name: string, args: string) => {
    if (name !== "search_airbnb") return;

    const params: SearchParams = JSON.parse(args);
    setSearchParams(params);
    setIsSearching(true);

    // Move current listings to stale
    setStaleListings((prev) => (listings.length > 0 ? listings : prev));
    setListings([]);

    searchAbortRef.current?.abort();
    const abort = new AbortController();
    searchAbortRef.current = abort;

    let totalFound = 0;

    try {
      const res = await fetch(`${API_URL}/api/search-params`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: abort.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const item = JSON.parse(jsonStr);

            if (item.__done) {
              totalFound = item.total;
              continue;
            }
            if (item.__error) {
              console.error("[search] error:", item.__error);
              continue;
            }

            // Add listing incrementally — clear stale on first real result
            setListings((prev) => {
              if (prev.length === 0) setStaleListings([]);
              return [...prev, item];
            });
            setIsSearching(false);
          } catch {}
        }
      }

      dcRef.current?.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({
              success: true,
              count: totalFound,
              summary: `Found ${totalFound} listings in ${params.location}`,
            }),
          },
        })
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      dcRef.current?.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ success: false, error: "Search failed" }),
          },
        })
      );
    } finally {
      if (!abort.signal.aborted) setIsSearching(false);
    }
  };

  const cleanup = useCallback(() => {
    micStream?.getTracks().forEach((t) => t.stop());
    dcRef.current?.close();
    pcRef.current?.close();
    pcRef.current = null;
    dcRef.current = null;
    setMicStream(null);
  }, [micStream]);

  const startVoice = useCallback(async () => {
    setVoiceStatus("connecting");
    setError("");
    setUserTranscript("");

    try {
      // Fetch token + mic in parallel
      const [tokenRes, stream] = await Promise.all([
        fetch(`${API_URL}/api/token`),
        navigator.mediaDevices.getUserMedia({
          audio: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId } }
            : true,
        }),
      ]);

      if (!tokenRes.ok) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("Failed to get session token");
      }
      const { client_secret } = await tokenRes.json();
      setMicStream(stream);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.addTrack(stream.getTracks()[0], stream);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        console.log("[realtime] data channel opened");
        setVoiceStatus("connected");
      };

      dc.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "input_audio_buffer.speech_started":
            setIsListening(true);
            break;
          case "input_audio_buffer.speech_stopped":
            setIsListening(false);
            break;
          case "conversation.item.input_audio_transcription.delta":
            setUserTranscript((prev) => prev + (msg.delta || ""));
            break;
          case "conversation.item.input_audio_transcription.completed":
            if (msg.transcript) setUserTranscript(msg.transcript);
            break;
          case "response.function_call_arguments.done":
            handleToolCallRef.current?.(msg.call_id, msg.name, msg.arguments);
            break;
          case "error":
            console.error("[realtime] error:", msg.error);
            setError(msg.error?.message || "Connection error");
            setVoiceStatus("error");
            break;
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2025-06-03",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${client_secret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        }
      );

      if (!sdpRes.ok) {
        const errText = await sdpRes.text();
        console.error("[realtime] SDP error:", sdpRes.status, errText);
        throw new Error(`SDP exchange failed: ${sdpRes.status}`);
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      console.log("[realtime] SDP exchange complete");
    } catch (err) {
      console.error("WebRTC connection error:", err);
      setError(err instanceof Error ? err.message : "Failed to connect");
      setVoiceStatus("error");
    }
  }, [selectedDeviceId]);

  const stopVoice = useCallback(() => {
    cleanup();
    setVoiceStatus("idle");
    setIsListening(false);
  }, [cleanup]);

  const isActive = voiceStatus === "connected" || voiceStatus === "connecting";

  return (
    <div className="min-h-screen bg-background font-[family-name:var(--font-geist-sans)] pb-24">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
        {/* Header */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
        >
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            AI Travel Assistant
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Speak to search for places to stay
          </p>
        </motion.div>

        {/* Search params pills */}
        {searchParams && (
          <div className="flex flex-wrap gap-2 mb-6 min-h-[32px]">
            {paramBadges(searchParams).map((label) => (
              <Badge key={label} variant="outline">{label}</Badge>
            ))}
            {isSearching && (
              <Badge variant="secondary" className="gap-1">
                <Loader2 size={12} className="animate-spin" />
                Searching...
              </Badge>
            )}
          </div>
        )}

        {/* Listings */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.15 }}
        >
          {(listings.length > 0 || isSearching) && (
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {searchParams?.location || "Places to stay"}
              </h2>
              {listings.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {listings.length} listings
                </span>
              )}
            </div>
          )}
          <ListingGrid
            listings={listings}
            isSearching={isSearching}
            staleListings={staleListings}
          />
        </motion.div>
      </div>

      {/* Floating voice card */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
        <div className="bg-card/95 backdrop-blur-xl shadow-lg border border-border/60 rounded-2xl px-3 py-2.5">
            <div className="flex items-center gap-3">
              {/* Mic button */}
              <Button
                size="icon"
                variant={isActive ? "destructive" : "default"}
                className="h-10 w-10 rounded-full shrink-0"
                onClick={isActive ? stopVoice : startVoice}
              >
                {voiceStatus === "connecting" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isActive ? (
                  <MicOff size={18} />
                ) : (
                  <Mic size={18} />
                )}
              </Button>

              {/* Visualizer / transcript / status */}
              <div className="flex-1 min-w-0 flex items-center gap-3">
                {isActive && micStream ? (
                  <>
                    <AudioVisualizer stream={micStream} />
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {userTranscript || (isListening ? "Listening..." : "Speak to search")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground truncate">
                    {voiceStatus === "error" ? error : "Click to start speaking"}
                  </p>
                )}
              </div>

              {/* Mic selector */}
              {!isActive && devices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="text-xs border border-border rounded-md px-2 py-1.5 bg-muted text-muted-foreground shrink-0 max-w-[130px] truncate"
                >
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Spinner from "./Spinner";
import TranscriptDisplay from "./TranscriptDisplay";
import ListingGrid from "./ListingGrid";
import type { Listing } from "./ListingCard";

type Status = "idle" | "recording" | "processing" | "results" | "error";

interface SearchResult {
  transcript: string;
  searchParams: {
    location: string;
    check_in: string | null;
    check_out: string | null;
    adults: number;
    children: number;
    infants: number;
    currency: string;
    maxListings: number;
  };
  listings: Listing[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return "";
}

export default function VoiceRecorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Enumerate audio input devices
  useEffect(() => {
    async function loadDevices() {
      try {
        // Request permission first so device labels are available
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices.filter((d) => d.kind === "audioinput");
        setDevices(audioInputs);
        if (audioInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(audioInputs[0].deviceId);
        }
      } catch {
        // Permission denied -- devices will stay empty
      }
    }
    loadDevices();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const mimeType = getMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());

        const mimeUsed = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeUsed });

        // Create playback URL
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));

        await sendAudio(blob, mimeUsed);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();

      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      setStatus("recording");
    } catch {
      setErrorMessage(
        "Could not access microphone. Please allow microphone permissions."
      );
      setStatus("error");
    }
  }, [selectedDeviceId]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    setStatus("processing");
  }, []);

  const sendAudio = async (blob: Blob, mimeType: string) => {
    try {
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const formData = new FormData();
      formData.append("audio", blob, `recording.${ext}`);

      const response = await fetch(`${API_URL}/api/search`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error: ${response.status}`);
      }

      const data: SearchResult = await response.json();
      setResult(data);
      setStatus("results");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong"
      );
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setErrorMessage("");
    setElapsed(0);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
  };

  return (
    <div className="space-y-8">
      {/* Device selector */}
      {status === "idle" && devices.length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="mic-select" className="text-sm text-zinc-500">
            Microphone:
          </label>
          <select
            id="mic-select"
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white text-zinc-800"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {status === "idle" && (
          <button
            onClick={startRecording}
            className="bg-red-500 hover:bg-red-600 text-white font-medium px-6 py-3 rounded-full transition-colors cursor-pointer"
          >
            Record
          </button>
        )}

        {status === "recording" && (
          <>
            <button
              onClick={stopRecording}
              className="bg-zinc-800 hover:bg-zinc-900 text-white font-medium px-6 py-3 rounded-full transition-colors cursor-pointer"
            >
              Stop
            </button>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-zinc-500 tabular-nums">
                {formatTime(elapsed)}
              </span>
            </div>
          </>
        )}

        {status === "processing" && <Spinner />}

        {(status === "results" || status === "error") && (
          <button
            onClick={reset}
            className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800 font-medium px-6 py-3 rounded-full transition-colors cursor-pointer"
          >
            Search Again
          </button>
        )}
      </div>

      {/* Playback */}
      {audioUrl && status !== "idle" && status !== "recording" && (
        <div>
          <h3 className="text-sm font-medium text-zinc-500 mb-2">Your recording:</h3>
          <audio controls src={audioUrl} className="w-full max-w-md" />
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Results */}
      {status === "results" && result && (
        <div className="space-y-8">
          <TranscriptDisplay
            transcript={result.transcript}
            searchParams={result.searchParams}
          />

          <div>
            <h2 className="text-lg font-semibold text-zinc-800 mb-4">
              Listings
              {result.listings.length > 0 && (
                <span className="text-zinc-400 font-normal text-sm ml-2">
                  ({result.listings.length} found)
                </span>
              )}
            </h2>
            <ListingGrid listings={result.listings} />
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

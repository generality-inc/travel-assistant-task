"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ease = [0.23, 1, 0.32, 1] as const;

interface SearchParams {
  location: string;
  check_in?: string | null;
  check_out?: string | null;
  adults?: number;
  children?: number;
  infants?: number;
  currency?: string;
  limit?: number;
}

interface TranscriptDisplayProps {
  userTranscript: string;
  aiTranscript: string;
  searchParams: SearchParams | null;
  isListening: boolean;
}

export default function TranscriptDisplay({
  userTranscript,
  aiTranscript,
  searchParams,
  isListening,
}: TranscriptDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [userTranscript, aiTranscript]);

  if (!userTranscript && !aiTranscript) return null;

  return (
    <div ref={scrollRef} className="space-y-3 max-h-48 overflow-y-auto">
      {userTranscript && (
        <div className="text-sm text-zinc-600">
          <span className="text-zinc-400 text-xs block mb-1">You</span>
          <p>
            {userTranscript}
            {isListening && (
              <span
                className="inline-block w-0.5 h-4 bg-zinc-400 ml-0.5 align-text-bottom"
                style={{ animation: "blink 1s steps(2) infinite" }}
              />
            )}
          </p>
        </div>
      )}

      {aiTranscript && (
        <div className="text-sm text-zinc-500">
          <span className="text-zinc-400 text-xs block mb-1">Assistant</span>
          <p>{aiTranscript}</p>
        </div>
      )}

      <AnimatePresence>
        {searchParams && (
          <motion.div
            className="flex flex-wrap gap-1.5 pt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Pill label={searchParams.location} />
            {searchParams.check_in && (
              <Pill label={`${searchParams.check_in} → ${searchParams.check_out || "?"}`} />
            )}
            {(searchParams.adults ?? 0) > 0 && (
              <Pill label={`${searchParams.adults} adult${(searchParams.adults ?? 0) > 1 ? "s" : ""}`} />
            )}
            {(searchParams.children ?? 0) > 0 && (
              <Pill label={`${searchParams.children} children`} />
            )}
            {searchParams.currency && searchParams.currency !== "USD" && (
              <Pill label={searchParams.currency} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <motion.span
      className="inline-block text-xs bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-full"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease }}
    >
      {label}
    </motion.span>
  );
}

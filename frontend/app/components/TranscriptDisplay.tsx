interface SearchParams {
  location: string;
  check_in: string | null;
  check_out: string | null;
  adults: number;
  children: number;
  infants: number;
  currency: string;
  maxListings: number;
}

interface TranscriptDisplayProps {
  transcript: string;
  searchParams: SearchParams;
}

export default function TranscriptDisplay({
  transcript,
  searchParams,
}: TranscriptDisplayProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-500 mb-1">
          You said:
        </h3>
        <blockquote className="border-l-4 border-zinc-300 pl-4 text-zinc-700 italic">
          &ldquo;{transcript}&rdquo;
        </blockquote>
      </div>

      <div>
        <h3 className="text-sm font-medium text-zinc-500 mb-2">
          Search parameters:
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <Param label="Location" value={searchParams.location} />
          <Param label="Check-in" value={searchParams.check_in || "Flexible"} />
          <Param label="Check-out" value={searchParams.check_out || "Flexible"} />
          <Param label="Guests" value={formatGuests(searchParams)} />
        </div>
      </div>
    </div>
  );
}

function Param({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-100 rounded px-3 py-2">
      <span className="text-zinc-400 block text-xs">{label}</span>
      <span className="text-zinc-800 font-medium">{value}</span>
    </div>
  );
}

function formatGuests(params: SearchParams): string {
  const parts = [];
  if (params.adults) parts.push(`${params.adults} adult${params.adults > 1 ? "s" : ""}`);
  if (params.children) parts.push(`${params.children} child${params.children > 1 ? "ren" : ""}`);
  if (params.infants) parts.push(`${params.infants} infant${params.infants > 1 ? "s" : ""}`);
  return parts.join(", ") || "1 adult";
}

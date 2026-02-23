import ListingCard, { type Listing } from "./ListingCard";

export default function ListingGrid({ listings }: { listings: Listing[] }) {
  if (listings.length === 0) {
    return (
      <p className="text-zinc-400 text-sm">
        No listings found. Try a different search.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {listings.map((listing, i) => (
        <ListingCard key={i} listing={listing} />
      ))}
    </div>
  );
}

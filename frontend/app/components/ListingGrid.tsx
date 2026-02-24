"use client";

import ListingCard, { type Listing } from "./ListingCard";
import ListingCardSkeleton from "./ListingCardSkeleton";

interface ListingGridProps {
  listings: Listing[];
  isSearching: boolean;
  staleListings: Listing[];
}

export default function ListingGrid({
  listings,
  isSearching,
  staleListings,
}: ListingGridProps) {
  const hasResults = listings.length > 0;
  const hasStale = staleListings.length > 0;

  if (!hasResults && !isSearching && !hasStale) {
    return (
      <p className="text-muted-foreground text-sm">
        No listings found. Try a different search.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Skeleton cards while searching */}
      {isSearching && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <ListingCardSkeleton key={`skel-${i}`} />
          ))}
        </div>
      )}

      {/* Current results */}
      {hasResults && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {listings.map((listing, i) => (
            <div key={`${listing.url}-${i}`}>
              <ListingCard listing={listing} />
            </div>
          ))}
        </div>
      )}

      {/* Previous results dimmed while new search runs */}
      {isSearching && hasStale && (
        <div className="opacity-40 transition-opacity duration-300">
          <p className="text-xs text-muted-foreground mb-3">Previous results</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {staleListings.map((listing, i) => (
              <div key={`stale-${listing.url}-${i}`}>
                <ListingCard listing={listing} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

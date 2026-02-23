export interface Listing {
  name: string;
  url: string;
  priceTotal: string | null;
  pricePerNight: string | null;
  rating: number | null;
  reviewCount: number;
  image: string | null;
  type: string;
  location: string;
  badges?: string[];
  bedrooms?: number | null;
  beds?: number | null;
  bathrooms?: number | null;
  capacity?: number | null;
  superhost?: boolean;
}

export default function ListingCard({ listing }: { listing: Listing }) {
  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border border-zinc-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
    >
      {listing.image ? (
        <img
          src={listing.image}
          alt={listing.name}
          className="w-full h-48 object-cover"
        />
      ) : (
        <div className="w-full h-48 bg-zinc-200 flex items-center justify-center text-zinc-400">
          No image
        </div>
      )}

      <div className="p-4 space-y-1.5">
        {listing.badges && listing.badges.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {listing.badges.map((badge) => (
              <span
                key={badge}
                className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        <h3 className="font-medium text-zinc-900 line-clamp-2 text-sm">
          {listing.name}
        </h3>

        <p className="text-xs text-zinc-400">
          {[listing.type, listing.location].filter(Boolean).join(" · ")}
        </p>

        <p className="text-xs text-zinc-500">
          {[
            listing.bedrooms != null && `${listing.bedrooms} bedrm`,
            listing.beds != null && `${listing.beds} bed${listing.beds !== 1 ? "s" : ""}`,
            listing.bathrooms != null && `${listing.bathrooms} bath`,
            listing.capacity != null && `${listing.capacity} guest${listing.capacity !== 1 ? "s" : ""}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        <div className="flex items-center justify-between pt-1">
          <div>
            {listing.priceTotal ? (
              <span className="font-semibold text-zinc-900 text-sm">
                {listing.priceTotal}
              </span>
            ) : (
              <span className="text-zinc-400 text-sm">Price N/A</span>
            )}
          </div>

          {listing.rating != null && (
            <span className="text-sm text-zinc-600">
              ★ {listing.rating}
              {listing.reviewCount > 0 && (
                <span className="text-zinc-400"> ({listing.reviewCount})</span>
              )}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

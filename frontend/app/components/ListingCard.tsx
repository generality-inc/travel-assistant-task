import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface Listing {
  name: string;
  url: string;
  price: number | null;
  originalPrice: number | null;
  qualifier: string | null;
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
  const hasDiscount =
    listing.originalPrice != null &&
    listing.price != null &&
    listing.originalPrice > listing.price;
  const discountPct = hasDiscount
    ? Math.round(
        ((listing.originalPrice! - listing.price!) / listing.originalPrice!) *
          100
      )
    : 0;

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block group h-full"
    >
      <Card className="overflow-hidden hover:shadow-md transition-shadow h-full py-0 gap-0 flex flex-col">
        {/* Image — fixed aspect ratio */}
        <div className="relative aspect-[4/3] overflow-hidden shrink-0">
          {listing.image ? (
            <img
              src={listing.image}
              alt={listing.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}

          {hasDiscount && (
            <Badge
              variant="secondary"
              className="absolute top-2 left-2 bg-green-600 text-white hover:bg-green-600"
            >
              {discountPct}% off
            </Badge>
          )}
        </div>

        {/* Content — fixed structure, always same height */}
        <CardContent className="p-4 flex flex-col gap-1.5 flex-1">
          {/* Badge row — always reserve space (min-h) */}
          <div className="flex gap-1 flex-wrap min-h-[22px]">
            {listing.badges?.map((badge) => (
              <Badge key={badge} variant="outline" className="text-[10px] font-normal">
                {badge}
              </Badge>
            ))}
          </div>

          {/* Name — always single line */}
          <h3 className="font-medium text-sm line-clamp-1 text-foreground">
            {listing.name}
          </h3>

          {/* Type + Location */}
          <p className="text-xs text-muted-foreground line-clamp-1">
            {[listing.type, listing.location].filter(Boolean).join(" · ")}
          </p>

          {/* Amenities */}
          <p className="text-xs text-muted-foreground">
            {[
              listing.capacity != null && `${listing.capacity} guest${listing.capacity !== 1 ? "s" : ""}`,
              listing.bedrooms != null && `${listing.bedrooms} bed${listing.bedrooms !== 1 ? "s" : ""}`,
              listing.bathrooms != null && `${listing.bathrooms} bath`,
            ]
              .filter(Boolean)
              .join(" · ") || "\u00A0"}
          </p>

          {/* Price + Rating — pinned to bottom */}
          <div className="flex items-center justify-between pt-1 mt-auto">
            <div className="flex items-baseline gap-1.5">
              {listing.price != null ? (
                <>
                  <span className="font-semibold text-sm">
                    ${listing.price.toLocaleString()}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-muted-foreground line-through">
                      ${listing.originalPrice!.toLocaleString()}
                    </span>
                  )}
                  {listing.qualifier && (
                    <span className="text-xs text-muted-foreground">
                      {listing.qualifier}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Price N/A</span>
              )}
            </div>

            {listing.rating != null && (
              <span className="text-xs text-muted-foreground shrink-0">
                ★ {listing.rating}
                {listing.reviewCount > 0 && (
                  <span> ({listing.reviewCount})</span>
                )}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

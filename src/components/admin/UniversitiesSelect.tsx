import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualUniversities } from "@/hooks/useVirtualUniversities";
import { Loader2, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UniversitiesSelectProps {
  onSelect: (university: { id: string; name: string }) => void;
  searchQuery?: string;
  selectedId?: string;
  disabled?: boolean;
}

/**
 * Virtual scrolling select for universities using ScrollArea + lazy loading
 * Loads 100 universities at a time to keep UI responsive
 */
export function UniversitiesSelect({
  onSelect,
  searchQuery = "",
  selectedId,
  disabled,
}: UniversitiesSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [displayCount, setDisplayCount] = useState(50);
  const { universities, loading, hasMore, error, loadMore } = useVirtualUniversities({
    pageSize: 100,
    searchQuery,
  });

  const selectedUni = universities.find((u) => u.id === selectedId);

  // Show subset of loaded universities
  const displayedUniversities = universities.slice(0, displayCount);
  const shouldShowLoadMore = displayCount < universities.length;

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100;

    // Load more from API if near bottom and more available
    if (nearBottom && hasMore && !loading && displayCount === universities.length) {
      loadMore();
      return;
    }

    // Render more from already-loaded data
    if (nearBottom && shouldShowLoadMore) {
      setDisplayCount((prev) => Math.min(prev + 50, universities.length));
    }
  }, [universities.length, hasMore, loading, displayCount, shouldShowLoadMore, loadMore]);

  return (
    <div className="relative w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 border rounded-md text-left text-sm bg-background hover:bg-muted disabled:opacity-50"
      >
        {selectedUni?.name || "Select university..."}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 border rounded-md bg-popover shadow-md mt-1">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {universities.length === 0 && !loading && (
            <div className="p-3 text-sm text-muted-foreground">No universities found</div>
          )}

          {universities.length > 0 && (
            <ScrollArea
              className="h-[400px] border-t"
              onScroll={handleScroll}
              ref={scrollRef}
            >
              <div className="flex flex-col">
                {displayedUniversities.map((uni) => (
                  <button
                    key={uni.id}
                    onClick={() => {
                      onSelect(uni);
                      setIsOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted text-foreground border-b last:border-b-0 transition-colors"
                  >
                    {uni.name}
                  </button>
                ))}

                {loading && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {shouldShowLoadMore && (
                  <button
                    onClick={() => setDisplayCount((prev) => prev + 50)}
                    className="w-full px-3 py-2 text-sm text-primary hover:bg-muted"
                  >
                    Show more ({universities.length - displayCount} remaining)...
                  </button>
                )}

                {hasMore && displayCount === universities.length && (
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="w-full px-3 py-2 text-sm text-primary hover:bg-muted disabled:opacity-50"
                  >
                    Load more universities...
                  </button>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}

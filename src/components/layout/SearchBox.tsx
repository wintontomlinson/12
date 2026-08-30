import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BrowseEntity, SearchSuggestions } from '@shared/types';
import { useApi } from '@/hooks/useApi';
import { useDebounce } from '@/hooks/useDebounce';
import { playEntity } from '@/lib/play';
import { entityIsRound, entityRoute, entitySubtitle, entityTitle } from '@/lib/entity';
import { cn } from '@/lib/utils';
import { CloseIcon, MusicNoteIcon, SearchIcon } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Search field with live debounced suggestions (requirement L2 / R2.1).
 *
 * Suggestions come from `/search/suggest`, which resolves all four entity groups
 * in one upstream round trip — important when the request fires per typing
 * pause. `useApi` discards superseded responses, so a slow early query can never
 * overwrite a newer one (requirement R2.3).
 *
 * Submitting navigates to `/search?q=`, keeping the query in the URL so results
 * are shareable and survive a refresh (requirement R2.4).
 */
export function SearchBox({ className }: { className?: string }): JSX.Element {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [term, setTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const debouncedTerm = useDebounce(term.trim(), 275);

  // `null` path means "don't fetch" — avoids a request for an empty box.
  const { data, isLoading, error } = useApi<SearchSuggestions>(
    debouncedTerm.length > 1 ? `/search/suggest?q=${encodeURIComponent(debouncedTerm)}&limit=4` : null,
  );

  // Close on Escape from anywhere in the widget.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const submit = (): void => {
    const query = term.trim();
    if (query.length === 0) return;
    setIsOpen(false);
    inputRef.current?.blur();
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const choose = (entity: BrowseEntity): void => {
    setIsOpen(false);
    const route = entityRoute(entity);
    // Songs play immediately; collections navigate to their detail page.
    if (route) navigate(route);
    else void playEntity(entity);
  };

  const groups = data
    ? [
        { label: 'Songs', items: data.songs as BrowseEntity[] },
        { label: 'Artists', items: data.artists as BrowseEntity[] },
        { label: 'Albums', items: data.albums as BrowseEntity[] },
        { label: 'Playlists', items: data.playlists as BrowseEntity[] },
      ].filter((group) => group.items.length > 0)
    : [];

  const hasResults = groups.length > 0;
  const showPanel = isOpen && debouncedTerm.length > 1;

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      // Close only when focus leaves the whole widget. A plain `onBlur` on the
      // input would fire before a suggestion click registers and swallow it.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
      }}
    >
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />

          <input
            ref={inputRef}
            type="search"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="What do you want to listen to?"
            aria-label="Search"
            aria-expanded={showPanel}
            aria-controls="search-suggestions"
            className="focus-ring w-full rounded-full border border-transparent bg-surface-raised py-2 pl-9 pr-9 text-sm text-white placeholder:text-muted hover:border-white/20 focus:border-white/40 [&::-webkit-search-cancel-button]:hidden"
          />

          {term.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTerm('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>

      {showPanel && (
        <div
          id="search-suggestions"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-card border border-white/10 bg-surface-raised p-2 shadow-2xl shadow-black/70"
        >
          {isLoading && !data && (
            <div className="space-y-2 p-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-1/2 rounded" />
                    <Skeleton className="h-2.5 w-1/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="px-3 py-4 text-sm text-red-300">{error}</p>}

          {!isLoading && !error && !hasResults && (
            <p className="px-3 py-4 text-sm text-muted">
              No results for “{debouncedTerm}”.
            </p>
          )}

          {hasResults &&
            groups.map((group) => (
              <div key={group.label} className="mb-1 last:mb-0">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {group.label}
                </p>
                <ul>
                  {group.items.map((entity) => (
                    <li key={`${entity.type}-${entity.id}`}>
                      <button
                        type="button"
                        onClick={() => choose(entity)}
                        className="focus-ring flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/10"
                      >
                        <span
                          className={cn(
                            'h-10 w-10 shrink-0 overflow-hidden bg-surface',
                            entityIsRound(entity) ? 'rounded-full' : 'rounded',
                          )}
                        >
                          {entity.image ? (
                            <img
                              src={entity.image}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-white/25">
                              <MusicNoteIcon className="h-4 w-4" />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-white">
                            {entityTitle(entity)}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {entitySubtitle(entity)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

          {hasResults && (
            <button
              type="button"
              onClick={submit}
              className="focus-ring mt-1 w-full rounded-md px-2 py-2 text-left text-xs font-semibold text-accent hover:bg-white/10"
            >
              See all results for “{debouncedTerm}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

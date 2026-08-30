import { useNavigate } from 'react-router-dom';
import { useUiStore } from '@/store/useUiStore';
import { SearchBox } from './SearchBox';
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon, UserIcon } from '@/components/ui/icons';

/**
 * Top bar: history navigation, search, profile (requirement L2).
 *
 * Sits inside the scrolling column with a translucent backdrop so content
 * passing underneath stays legible.
 */
export function Topbar(): JSX.Element {
  const navigate = useNavigate();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-base/80 px-4 py-3 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={toggleSidebar}
        className="focus-ring rounded p-1.5 text-white md:hidden"
        aria-label="Open navigation"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {/*
        History arrows are always enabled: the History API exposes no reliable
        way to know whether entries exist in either direction, and rendering them
        permanently disabled would be worse than a no-op click.
      */}
      <div className="hidden items-center gap-2 md:flex">
        <NavArrow direction="back" onClick={() => navigate(-1)} />
        <NavArrow direction="forward" onClick={() => navigate(1)} />
      </div>

      <SearchBox className="min-w-0 flex-1 sm:max-w-md" />

      <button
        type="button"
        className="focus-ring ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-muted transition-colors hover:text-white"
        aria-label="Profile"
      >
        <UserIcon className="h-[18px] w-[18px]" />
      </button>
    </header>
  );
}

function NavArrow({
  direction,
  onClick,
}: {
  direction: 'back' | 'forward';
  onClick: () => void;
}): JSX.Element {
  const Glyph = direction === 'back' ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === 'back' ? 'Go back' : 'Go forward'}
      className="focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black"
    >
      <Glyph className="h-4 w-4" />
    </button>
  );
}

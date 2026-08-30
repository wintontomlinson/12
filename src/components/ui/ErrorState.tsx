import { AlertIcon } from './icons';
import { cn } from '@/lib/utils';

/**
 * Failure state with a retry action (requirement R8.2).
 *
 * `compact` is used inside a single carousel so one failed section degrades in
 * place instead of replacing the whole page (requirement R8.3).
 */
export function ErrorState({
  message,
  onRetry,
  compact = false,
  className,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-white/5 bg-surface text-center',
        compact ? 'px-4 py-6' : 'px-6 py-14',
        className,
      )}
    >
      <AlertIcon className={cn('text-muted', compact ? 'h-6 w-6' : 'h-9 w-9')} />

      <div>
        <p className={cn('font-semibold text-white', compact ? 'text-sm' : 'text-base')}>
          Something went wrong
        </p>
        <p className={cn('mt-1 text-muted', compact ? 'text-xs' : 'text-sm')}>{message}</p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="focus-ring rounded-full bg-white px-4 py-1.5 text-xs font-bold text-black transition-transform hover:scale-105"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Neutral empty state — distinct from an error (requirement R2.5). */
export function EmptyState({
  title,
  detail,
  className,
}: {
  title: string;
  detail?: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('px-6 py-14 text-center', className)}>
      <p className="text-base font-semibold text-white">{title}</p>
      {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
    </div>
  );
}

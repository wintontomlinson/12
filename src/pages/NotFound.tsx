import { Link } from 'react-router-dom';

/** Unmatched route. */
export function NotFound(): JSX.Element {
  return (
    <div className="pt-20 text-center">
      <p className="text-6xl font-extrabold text-white/10">404</p>
      <h1 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Page not found</h1>
      <p className="mt-2 text-sm text-muted">
        The link may be broken, or the page may have moved.
      </p>
      <Link
        to="/"
        className="focus-ring mt-6 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black transition-transform hover:scale-105"
      >
        Back to home
      </Link>
    </div>
  );
}

'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="bg-secondary min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold font-headline mb-2">
          Failed to load communities
        </h2>
        <p className="text-muted-foreground mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

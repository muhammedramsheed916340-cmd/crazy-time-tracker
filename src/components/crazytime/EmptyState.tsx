"use client";

import { cn } from "@/lib/utils";

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
        <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">{message}</p>
    </div>
  );
}

export function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
      <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
        <span className="text-red-600 text-lg">!</span>
      </div>
      <p className="text-sm text-red-600 dark:text-red-400 max-w-xs">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            "text-xs px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition"
          )}
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function LoadingGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-16 rounded-md bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
      ))}
    </div>
  );
}

'use client';

/** The single committing action per screen — Campus Emerald pill (DESIGN.md). */
export function BookButton({
  label,
  busyLabel,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const isDisabled = busy || disabled;
  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={busy}
      onClick={onPress}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      ) : null}
      {busy ? busyLabel : label}
    </button>
  );
}

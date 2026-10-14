/**
 * Own radio drawn with theme tokens. The native radio painted with `accent-primary` reads backwards on the dark theme
 * (unchosen = solid white disc, chosen = ring), so the circle is drawn here: muted ring when unchosen, foreground ring
 * plus an inner dot (`currentColor` = `text-foreground`) when chosen.
 */
export const RADIO_CLASS = [
  'size-4 shrink-0 appearance-none rounded-full border-2 border-muted-foreground bg-transparent text-foreground',
  'checked:border-foreground checked:bg-[radial-gradient(circle,currentColor_0,currentColor_35%,transparent_40%)]',
  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

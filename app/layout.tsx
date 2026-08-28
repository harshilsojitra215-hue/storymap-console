import type { Metadata } from "next";
import { Instrument_Serif, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

/**
 * Three faces, used deliberately (see app/globals.css for where each lands):
 * an editorial serif for the story card's titles, a grotesque sans for every
 * other piece of interface text, and a monospace with tabular figures for
 * every coordinate, number and field label in the editor — the numbers that
 * are the whole subject of this prototype get a typeface that says so.
 *
 * next/font/google self-hosts the font files at build time and handles
 * font-display and subsetting itself, so there is no runtime connection to
 * Google's font CDN in production — see the missing fonts.googleapis.com
 * preconnect below, which would be actively wrong to add on top of this.
 */
// Named with a "-google" suffix deliberately: globals.css composes these into
// --font-serif/--font-sans/--font-mono alongside a plain-text fallback stack,
// so the variable actually used everywhere else always has somewhere to land
// even if a font file is still loading.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif-google",
});
const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans-google",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono-google",
});

export const metadata: Metadata = {
  title: "Storymap Editor Console",
  description:
    "A split-pane prototype: edit a map-driven story chapter and see the result live, with no reload between editing and checking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        {/* The map preview fetches its style and tiles from here on first
            paint. Opening the connection early — DNS, TLS, TCP — before the
            map library has even finished downloading shaves that latency off
            the moment tiles start arriving. */}
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
        <link rel="dns-prefetch" href="https://demotiles.maplibre.org" />
        {/* The style document itself, not just the connection: MapPreview
            only starts building the map after React hydrates and the map
            library's own dynamic import resolves, which is well after this
            tag is parsed. Preloading the JSON here means the browser has
            already started fetching it by the time MapLibre asks for it, so
            hydration time stops being tile-fetch time. */}
        <link
          rel="preload"
          href="https://tiles.openfreemap.org/styles/liberty"
          as="fetch"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {children}
        {/* The script it injects only exists on Vercel's own infrastructure —
            `VERCEL` is a system env var Vercel sets automatically at build and
            runtime. Rendering it unconditionally would 404 on every local
            `next build && next start`, which is exactly how this project's own
            acceptance checks run before each deploy. */}
        {process.env.VERCEL === "1" && <SpeedInsights />}
      </body>
    </html>
  );
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // "Newsroom at night" palette -- a wire-service terminal, not a
        // printed page. Signature idea: the timeline reads like a pulse/EKG
        // strip, literalizing the product name.
        ink: "#10141A",       // near-black background, slightly blue
        panel: "#171C24",     // raised surface
        line: "#262C36",      // hairlines / borders
        paper: "#E9E6DD",     // primary text, warm off-white (like teletype paper)
        muted: "#8891A0",     // secondary text
        pulse: "#FF8A3D",     // amber signal accent -- the "pulse"
        pulseDim: "#7A4A26",
        wire: "#4FD1C5",      // teletype-green/teal for source tags & links
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
        mono: ["'IBM Plex Mono'", "'JetBrains Mono'", "ui-monospace", "monospace"],
        body: ["'Helvetica Neue'", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

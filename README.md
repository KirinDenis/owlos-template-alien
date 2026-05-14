# ALIEN / ALIENS — Fan Site

A fan-tribute site for the original *Alien* (1979) and *Aliens* (1986).

## Features
- **Live motion-tracker background** — a top-down station map covers the entire page (canvas), with corridor walls, doors, and a periodic green/red blip sweep. Marines = green dots; xenomorphs = red dots. Both follow the corridors and leave fading "trails" behind them. Hover any blip to read its label.
- **Custom cursor** — green crosshair when hovering safe zones, red biohazard when hovering xenomorph blips.
- **Ambient sound** — synthesized through Web Audio API: low engine hum, distant metallic clanks, motion-tracker pings synced with sweeps, optional toggle for the famous tracker "beep" cadence. No mp3/wav downloads — generated on the fly.
- **CRT scanlines & vignette overlay** for the in-world feel.
- **Glitching text** in section headings.
- **Six content blocks**: synopsis, cast & crew (Sigourney Weaver, Ridley Scott, James Cameron, H.R. Giger), production facts, xenomorph life-cycle, cultural impact, and a marketplace strip.
- **Footer credit**: *Designed with ♥ by owlos.sk*

## Tech
- Single self-contained folder. `index.html`, `style.css`, `tracker.js`, `audio.js`, `fonts/`.
- Self-hosted fonts (Owlos design system).
- Vanilla JS — no frameworks, no CDN dependencies for code.
- Photos: referenced from Wikipedia/Wikimedia URLs. For production replace with locally licensed images.

## Run
Open `index.html` in a modern browser. Click anywhere to enable audio (browsers require user gesture).

## License
MIT — Copyright © 2026 Denys Kirin

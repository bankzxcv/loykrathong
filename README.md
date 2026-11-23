# Loy Krathong

A mobile-first moonlit pond, drawn entirely in the browser. Write an optional wish, then swipe or drag across the water or press **Float my krathong**. Fireworks and their reflections appear as the candlelit lotus floats away. Press **Float another** to clear the wish and prepare a fresh lotus. On short landscape screens the controls sit beside the pond. Reduced-motion mode settles the lotus immediately.

The pond plays [Suntaraporn’s Thai recording of “Ram Wong Loy Krathong”](https://www.youtube.com/watch?v=thx14NDZZsw) from a bundled HE-AAC file. When the browser blocks autoplay, playback starts after the first tap or key press. Use **Music** to pause or resume it. After the float, **IG Share** opens the device share menu for the Story image when supported and saves a PNG otherwise. Wishes are included in the image only when selected.

## Run locally

Open `public/index.html` directly, or serve the app from the repository root.

```sh
python3 -m http.server 8000 --directory public
```

Open [the local pond](http://localhost:8000). All artwork, scripts, and styles are bundled locally.

## Deploy to Vercel

Import the repository into Vercel and leave the root directory at the repository root. The included `vercel.json` selects the **Other** framework preset, skips the build step, and serves `public/`. Alternatively, run `vercel --prod` from the repository root. The app needs no dependencies or environment variables. [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build)

## Browser checks

- Desktop Chrome loaded the page without console errors. Keyboard release and replay, the four-second float, and short and mostly vertical drags passed.
- Chrome touch emulation confirmed that swipes settled the lotus on the corresponding side and a cancelled swipe restored its center position.
- Layout checks passed at 320, 375, 390, and 430 CSS pixels wide. Reduced-motion release settled immediately.
- Chrome mobile emulation verified wish entry and replay, both swipe directions, and rotation during a float. Checked the wish controls and fireworks in portrait and landscape, including a 568 × 280 landscape viewport.
- Chrome denied native fullscreen in the test environment. The in-page fallback preserved the float, resized to landscape, and restored focus on exit. Native fullscreen on a supporting device and physical iPhone Safari remain unverified.

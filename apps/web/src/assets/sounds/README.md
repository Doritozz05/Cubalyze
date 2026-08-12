# Cube turn sounds

Randomized layer-turn sound effects for the replay and virtual-cube views.

| File      | Original (Freesound)                          | Trimmed length |
| --------- | --------------------------------------------- | -------------- |
| turn-1.wav | `486563__spacejoe__rubik-cube-turn-11.wav`   | ~0.41 s |
| turn-2.wav | `486578__spacejoe__rubik-cube-turn-25.wav`   | ~0.28 s |
| turn-3.wav | `486583__spacejoe__rubik-cube-turn-7.wav`    | ~0.37 s |
| turn-4.wav | `486585__spacejoe__rubik-cube-turn-9.wav`    | ~0.30 s |

Source: [Freesound](https://freesound.org) — user **spacejoe**, "rubik cube turn"
series.

Processing: the original files carried 340–490 ms of leading silence and a
long dead tail, which made the click arrive late. They were trimmed to the
audible window (3 ms pre-roll + 2 ms fade-in + 100 ms decay + 40 ms fade-out),
peak-normalized to 85%, and re-encoded from 24-bit to 16-bit PCM (~4× smaller,
faster to load/decode). See the module header in `utils/cubeTurnSounds.ts`
for the consumption contract.

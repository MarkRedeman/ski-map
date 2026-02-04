# Audio Files for Ride Playback

This folder contains audio tracks that play during ride playback, changing based on the current segment type.

## Current Tracks (Placeholders)

These are silent placeholder files. Replace them with real music:

| File | Category | Mood Suggestion |
|------|----------|-----------------|
| `skiing-blue.mp3` | Blue slopes | Chill, relaxed electronic (90-110 BPM) |
| `skiing-red.mp3` | Red slopes | Upbeat, energetic (120-140 BPM) |
| `skiing-black.mp3` | Black slopes | Intense, driving (140-160 BPM) |
| `lift.mp3` | Lift rides | Ambient, scenic, peaceful |
| `idle.mp3` | Rest/waiting | Very calm, nature sounds |

## Adding Real Music

1. Find royalty-free music from:
   - [Pixabay Music](https://pixabay.com/music/) (free, no attribution)
   - [Free Music Archive](https://freemusicarchive.org/)
   - [YouTube Audio Library](https://studio.youtube.com/channel/audio)

2. Download tracks matching the mood suggestions above

3. Convert to MP3 if needed (128-192 kbps is fine)

4. Replace the placeholder files with your downloaded tracks

5. Keep the same filenames or update `src/audio/tracks.ts`

## Technical Requirements

- Format: MP3 (best browser compatibility)
- Duration: 2-4 minutes (tracks loop automatically)
- Bitrate: 128-192 kbps (balance quality vs size)
- Channels: Stereo preferred, Mono works

## Removing Audio System

To completely remove the audio system:

1. Delete this folder (`public/audio/`)
2. Delete `src/audio/`
3. Remove `AudioToggleButton` import from `PlaybackControls.tsx`
4. Remove `usePlaybackAudio(ride)` call from `PlaybackControls.tsx`

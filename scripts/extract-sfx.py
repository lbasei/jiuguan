"""One-off: crop 5 UI SFX clips from 种种音效.wav into assets/audio/."""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "种种大开发文档" / "种种音效.wav"
OUT_DIR = ROOT / "assets" / "audio"

CLIPS = [
    {
        "name": "sfx-tap.wav",
        "start": 3.72,
        "duration": 0.22,
        "fade_in": 0.008,
        "fade_out": 0.08,
        "gain": 0.85,
    },
    {
        "name": "sfx-confirm.wav",
        "start": 44.88,
        "duration": 0.38,
        "fade_in": 0.015,
        "fade_out": 0.12,
        "gain": 0.9,
    },
    {
        "name": "sfx-enter.wav",
        "start": 0.0,
        "duration": 1.05,
        "fade_in": 0.05,
        "fade_out": 0.22,
        "gain": 0.88,
    },
    {
        "name": "sfx-bell.wav",
        "start": 56.58,
        "duration": 0.58,
        "fade_in": 0.01,
        "fade_out": 0.18,
        "gain": 0.92,
    },
    {
        "name": "sfx-success.wav",
        "start": 48.92,
        "duration": 0.72,
        "fade_in": 0.02,
        "fade_out": 0.20,
        "gain": 0.9,
    },
]


def read_segment(path: Path, start: float, duration: float):
    with wave.open(str(path), "rb") as src:
        channels = src.getnchannels()
        sample_rate = src.getframerate()
        sample_width = src.getsampwidth()
        if sample_width != 2:
            raise ValueError(f"expected 16-bit PCM, got width={sample_width}")

        start_frame = max(0, int(start * sample_rate))
        frame_count = max(1, int(duration * sample_rate))
        src.setpos(min(start_frame, src.getnframes()))
        raw = src.readframes(frame_count)

    sample_count = len(raw) // 2
    samples = list(struct.unpack("<" + "h" * sample_count, raw))

    # Stereo interleaved -> mono average
    if channels == 2:
        mono = []
        for i in range(0, len(samples), 2):
            left = samples[i]
            right = samples[i + 1] if i + 1 < len(samples) else left
            mono.append(int((left + right) / 2))
        samples = mono

    return samples, sample_rate


def apply_fades(samples: list[int], sample_rate: int, fade_in: float, fade_out: float, gain: float):
    total = len(samples)
    fade_in_frames = min(total, int(fade_in * sample_rate))
    fade_out_frames = min(total, int(fade_out * sample_rate))
    out = []

    peak = max(1, max(abs(s) for s in samples))
    normalize = min(1.0, 28000 / peak)

    for i, sample in enumerate(samples):
        amp = sample * normalize * gain
        if fade_in_frames and i < fade_in_frames:
            amp *= i / fade_in_frames
        if fade_out_frames and i >= total - fade_out_frames:
            amp *= max(0.0, (total - i) / fade_out_frames)
        out.append(int(max(-32767, min(32767, amp))))

    return out


def write_wav(path: Path, samples: list[int], sample_rate: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as dst:
        dst.setnchannels(1)
        dst.setsampwidth(2)
        dst.setframerate(sample_rate)
        dst.writeframes(struct.pack("<" + "h" * len(samples), *samples))


def main():
    if not SOURCE.exists():
        raise SystemExit(f"source missing: {SOURCE}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"source: {SOURCE}")
    print(f"output: {OUT_DIR}")

    for clip in CLIPS:
        samples, sample_rate = read_segment(SOURCE, clip["start"], clip["duration"])
        processed = apply_fades(
            samples,
            sample_rate,
            clip["fade_in"],
            clip["fade_out"],
            clip["gain"],
        )
        dest = OUT_DIR / clip["name"]
        write_wav(dest, processed, sample_rate)
        seconds = len(processed) / sample_rate
        print(f"  {clip['name']:16} start={clip['start']:5.2f}s dur={seconds:.2f}s frames={len(processed)}")

    print("done")


if __name__ == "__main__":
    main()

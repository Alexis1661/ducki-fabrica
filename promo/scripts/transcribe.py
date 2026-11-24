"""Word timings of a voice file with faster-whisper: python scripts/transcribe.py IN.wav OUT.json

IN is 16 kHz mono WAV (npx remotion ffmpeg -i voz.mp3 -ac 1 -ar 16000 voz.wav): the
installed PyAV cannot decode for faster-whisper, so the samples go in as an array.
"""
import json
import os
import sys
import wave

import numpy as np

from faster_whisper import WhisperModel

src, out = sys.argv[1], sys.argv[2]
model = WhisperModel(os.environ.get('WHISPER_MODEL', 'medium'), device='cpu', compute_type='int8')
with wave.open(src) as w:
    audio = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768
segments, _ = model.transcribe(audio, language='es', word_timestamps=True, vad_filter=False)
words = []
for seg in segments:
    for w in seg.words:
        words.append({'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3)})
json.dump(words, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(words), 'words')

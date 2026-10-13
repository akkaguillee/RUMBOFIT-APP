#!/usr/bin/env bash
# Final mix and encode with FFmpeg: music ducked under the voice (sidechain),
# effects on top, two-pass loudness normalisation (-14 LUFS, -1 dBTP) and
# H.264 + AAC MP4 for Reels / TikTok / Shorts.
set -euo pipefail
cd "$(dirname "$0")/.."
STEMS=audio/stems
VIDEO=out/video-silent.mp4
OUT=out/RUMBO-promo-9x16.mp4
GRAPH="[0:a]volume=0.62[m];[2:a]asplit=2[vk][vo];[m][vk]sidechaincompress=threshold=0.025:ratio=7:attack=12:release=320:makeup=1[md];[1:a]volume=0.62[s];[vo]equalizer=f=3200:t=q:w=1.2:g=2.5,acompressor=threshold=0.1:ratio=3:attack=5:release=120:makeup=1.6[v];[md][s][v]amix=inputs=3:normalize=0,atrim=0:20,afade=t=out:st=19.4:d=0.6"

# Pass 1: measure loudness
STATS=$(ffmpeg -hide_banner -nostats -i $STEMS/music.wav -i $STEMS/sfx.wav -i $STEMS/voice.wav \
  -filter_complex "$GRAPH,loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$STATS" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
MI=$(get input_i); MTP=$(get input_tp); MLRA=$(get input_lra); MTH=$(get input_thresh); OFF=$(get target_offset)

# Pass 2: apply and mux with the Remotion render
ffmpeg -hide_banner -y -i $STEMS/music.wav -i $STEMS/sfx.wav -i $STEMS/voice.wav -i $VIDEO \
  -filter_complex "$GRAPH,loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=$MI:measured_TP=$MTP:measured_LRA=$MLRA:measured_thresh=$MTH:offset=$OFF:linear=true,aresample=48000[a]" \
  -map 3:v:0 -map "[a]" \
  -vf "scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p" \
  -c:v libx264 -preset slow -crf 19 -maxrate 14M -bufsize 28M -profile:v high -level:v 4.2 -r 30 -g 60 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -t 20 -movflags +faststart "$OUT"
echo "Wrote $OUT"

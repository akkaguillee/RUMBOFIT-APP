#!/usr/bin/env bash
# Final mix and encode with FFmpeg: music ducked under the voice (sidechain),
# effects on top, two-pass loudness normalisation (-14 LUFS, -1 dBTP) and
# H.264 + AAC MP4 for Reels / TikTok / Shorts.
# Defaults are the 40 s cut; the cinematic cut sets STEMS, VIDEO, OUT, LEN and MAXRATE
# (see the mux:cine script in package.json).
set -euo pipefail
cd "$(dirname "$0")/.."
STEMS=${STEMS:-audio/stems}
VIDEO=${VIDEO:-out/video-silent.mp4}
OUT=${OUT:-out/RUMBO-promo-9x16.mp4}
LEN=${LEN:-40}
MAXRATE=${MAXRATE:-14}  # video peak bitrate, Mbit/s
FADE=$(python3 -c "print($LEN - 0.7)")
GRAPH="[0:a]volume=0.6[m];[2:a]asplit=2[vk][vo];[m][vk]sidechaincompress=threshold=0.02:ratio=6:attack=15:release=350:makeup=1[md];[1:a]volume=0.6[s];[vo]acompressor=threshold=0.12:ratio=2.5:attack=8:release=140:makeup=1.5,alimiter=limit=0.95:attack=2:release=40[v];[md][s][v]amix=inputs=3:normalize=0,atrim=0:$LEN,afade=t=out:st=$FADE:d=0.7"

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
  -c:v libx264 -preset slow -crf 19 -maxrate ${MAXRATE}M -bufsize $((2 * MAXRATE))M -profile:v high -level:v 4.2 -r 30 -g 60 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -ac 2 -t $LEN -movflags +faststart "$OUT"
echo "Wrote $OUT"

#!/usr/bin/env bash
# Encodes a render to fit a file size (two-pass H.264), taking the finished mix from a muxed MP4.
# GitHub refuses files over 100 MB: the 2K masters are fitted to ~95 MB for the repository.
#   bash audio/fit.sh SILENT_RENDER.mp4 MIXED.mp4 OUT.mp4 95 [LEVEL]
set -euo pipefail
VIDEO=$1
MIXED=$2
OUT=$3
MB=${4:-95}
LEVEL=${5:-5.1}
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MIXED")
AUDIO=$(ffprobe -v error -select_streams a:0 -show_entries stream=bit_rate -of csv=p=0 "$MIXED")
FPS=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$VIDEO" | cut -d/ -f1)
KBPS=$(python3 -c "print(int(($MB * 8e6 / $DUR - $AUDIO) / 1000 * 0.985))")
echo "video ${KBPS}k for ${MB} MB over ${DUR}s"
LOG=$(mktemp -d)/x264
VF="scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p"
ENC=(-c:v libx264 -preset slow -b:v "${KBPS}k" -maxrate "$((KBPS * 2))k" -bufsize "$((KBPS * 4))k" -profile:v high -level:v "$LEVEL" -r "$FPS" -g "$((2 * FPS))"
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
ffmpeg -hide_banner -nostats -y -i "$VIDEO" -vf "$VF" "${ENC[@]}" -pass 1 -passlogfile "$LOG" -an -t "$DUR" -f mp4 /dev/null
ffmpeg -hide_banner -nostats -y -i "$VIDEO" -i "$MIXED" -map 0:v:0 -map 1:a:0 -vf "$VF" "${ENC[@]}" -pass 2 -passlogfile "$LOG" -c:a copy -t "$DUR" -movflags +faststart "$OUT"
ls -la "$OUT"

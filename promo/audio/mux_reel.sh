#!/usr/bin/env bash
# Reel «Cada pequeño paso cuenta»: final mixes and encodes with FFmpeg.
#
#   RUMBO-reel-9x16.mp4 / RUMBO-reel-4x5.mp4   music + effects (+ voice when the
#       final ElevenLabs takes are in audio/voice-reel/elevenlabs), -14 LUFS.
#   RUMBO-reel-9x16-voz-guia-provisional.mp4   the same with the provisional
#       local guide voice, only to judge rhythm and sync (not for publishing).
#   audio/  voice stem, music + effects stem, the partial ElevenLabs takes.
#
# Music ducks under the voice (sidechain); two-pass loudness normalisation
# (-14 LUFS, -1 dBTP); H.264 High + AAC 48 kHz for Reels and TikTok.
set -euo pipefail
cd "$(dirname "$0")/.."
STEMS=audio/stems-reel
OUT=out/reel
LEN=$(python3 -c "import json; c=json.load(open('src/reel/cues.json')); print(c['frames']/c['fps'])")
FADE=$(python3 -c "print($LEN - 0.8)")
SOURCE=$(python3 -c "import json; print(json.load(open('src/reel/voice.json'))['source'])")
mkdir -p "$OUT/audio"

WITH_VOICE="[0:a]volume=0.62[m];[2:a]asplit=2[vk][vo];[m][vk]sidechaincompress=threshold=0.02:ratio=6:attack=15:release=350:makeup=1[md];[1:a]volume=0.6[s];[vo]acompressor=threshold=0.12:ratio=2.5:attack=8:release=140:makeup=1.5,alimiter=limit=0.95:attack=2:release=40[v];[md][s][v]amix=inputs=3:normalize=0,atrim=0:$LEN,afade=t=out:st=$FADE:d=0.8"
NO_VOICE="[0:a]volume=0.8[m];[1:a]volume=0.6[s];[m][s]amix=inputs=2:normalize=0,atrim=0:$LEN,afade=t=out:st=$FADE:d=0.8"

encode() { # graph video out maxrate
  local graph=$1 video=$2 out=$3 maxrate=$4
  local stats mi mtp mlra mth off
  stats=$(ffmpeg -hide_banner -nostats -i $STEMS/music.wav -i $STEMS/sfx.wav -i $STEMS/voice.wav \
    -filter_complex "$graph,loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
  get() { echo "$stats" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
  mi=$(get input_i); mtp=$(get input_tp); mlra=$(get input_lra); mth=$(get input_thresh); off=$(get target_offset)
  ffmpeg -hide_banner -loglevel error -y -i $STEMS/music.wav -i $STEMS/sfx.wav -i $STEMS/voice.wav -i "$video" \
    -filter_complex "$graph,loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$off:linear=true,aresample=48000[a]" \
    -map 3:v:0 -map "[a]" \
    -vf "scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p" \
    -c:v libx264 -preset slow -crf 19 -maxrate ${maxrate}M -bufsize $((2 * maxrate))M -profile:v high -level:v 4.2 -r 30 -g 60 \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -c:a aac -b:a 256k -ar 48000 -ac 2 -t "$LEN" -movflags +faststart "$out"
  echo "Wrote $out"
}

if [ "$SOURCE" = "elevenlabs" ]; then MASTER=$WITH_VOICE; else MASTER=$NO_VOICE; fi
encode "$MASTER" $OUT/reel-silent.mp4 $OUT/RUMBO-reel-9x16.mp4 7
[ -f $OUT/reel45-silent.mp4 ] && encode "$MASTER" $OUT/reel45-silent.mp4 $OUT/RUMBO-reel-4x5.mp4 6
if [ "$SOURCE" != "elevenlabs" ]; then
  encode "$WITH_VOICE" $OUT/reel-silent.mp4 $OUT/RUMBO-reel-9x16-voz-guia-provisional.mp4 5
fi

# Stems: the clean voice on the timeline, and music + effects without it.
ffmpeg -hide_banner -loglevel error -y -i $STEMS/voice.wav -af "pan=mono|c0=c0,atrim=0:$LEN,loudnorm=I=-16:TP=-1.5" -ar 48000 -c:a pcm_s16le \
  "$OUT/audio/locucion-$SOURCE.wav"
ffmpeg -hide_banner -loglevel error -y -i $STEMS/music.wav -i $STEMS/sfx.wav -filter_complex "$NO_VOICE" -ar 48000 -c:a pcm_s16le "$OUT/audio/musica-y-efectos.wav"
mkdir -p "$OUT/audio/elevenlabs-tomas"
cp audio/voice-reel/elevenlabs/*.mp3 "$OUT/audio/elevenlabs-tomas/" 2>/dev/null || true
echo "Stems in $OUT/audio"

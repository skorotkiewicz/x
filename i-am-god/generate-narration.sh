#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SOURCE=${SOURCE:-"$ROOT/message-to-god.md"}
OUT_DIR=${OUT_DIR:-"$ROOT/assets/narration"}
API_URL=${OPENROUTER_TTS_URL:-"https://openrouter.ai/api/v1/audio/speech"}
MODEL=${OPENROUTER_TTS_MODEL:-"fish-audio/s2.1-pro-free:free"}
SPEED=${TTS_SPEED:-0.96}

BASE_DIRECTION="Speak as a calm, intelligent witness addressing someone immensely powerful. Be intimate, measured, and brutally sincere. Use natural human pacing and clear diction. Never sound preachy, theatrical, sarcastic, robotic, or like a movie trailer. Treat suffering with restraint, not melodrama. Preserve the wording exactly and leave a natural pause at the end."

usage() {
  cat <<'EOF'
Generate AI narration for “Dear God, We Need to Talk” through OpenRouter.

Usage:
  ./generate-narration.sh audition
  ./generate-narration.sh generate [voice]

Commands:
  audition          Generate the same short sample with cedar and marin.
  generate [voice]  Generate one MP3 per letter paragraph (default: cedar)
                    and assets/narration/manifest-VOICE.json.

Required:
  OPENROUTER_API_KEY  OpenRouter API key. Keep it in your environment.

Optional environment variables:
  YES=1                       Skip the paid-call confirmation.
  FORCE=1                     Replace existing clips.
  TTS_SPEED=0.96              Speech speed (0.25–4.0).
  OUT_DIR=/path               Output directory.
  OPENROUTER_TTS_MODEL=...    Override the model ID.
  OPENROUTER_HTTP_REFERER=... Optional OpenRouter attribution URL.
  OPENROUTER_APP_TITLE=...    Optional OpenRouter attribution title.

Examples:
  export OPENROUTER_API_KEY='...'
  ./generate-narration.sh audition
  ./generate-narration.sh generate cedar
  YES=1 ./generate-narration.sh generate marin

OpenRouter usage costs credits. Existing files are skipped unless FORCE=1.
EOF
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

confirm_paid_calls() {
  local description=$1
  [[ ${YES:-0} == 1 ]] && return
  [[ -t 0 ]] || fail "Confirmation required for paid API calls. Review the command, then rerun with YES=1."
  printf '%s This spends OpenRouter credits. Continue? [y/N] ' "$description"
  read -r answer
  [[ $answer == y || $answer == Y ]] || { printf 'Cancelled.\n'; exit 0; }
}

is_mp3() {
  python3 - "$1" <<'PY'
from pathlib import Path
import sys

data = Path(sys.argv[1]).read_bytes()
valid_frame = len(data) > 2 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0
raise SystemExit(0 if len(data) > 1024 and (data.startswith(b"ID3") or valid_frame) else 1)
PY
}

generate_clip() {
  local voice=$1
  local text=$2
  local direction=$3
  local output=$4

  if [[ -s $output && ${FORCE:-0} != 1 ]]; then
    printf 'skip  %s\n' "${output#"$ROOT/"}"
    return
  fi

  mkdir -p "$(dirname -- "$output")"
  local audio_file="${output}.audio.part"
  local request_json

  request_json=$(python3 - "$MODEL" "$voice" "$text" "$BASE_DIRECTION $direction" "$SPEED" <<'PY'
import json
import sys

model, voice, text, instructions, speed = sys.argv[1:]
if not text or len(text) > 4096:
    raise SystemExit(f"TTS input must contain 1–4096 characters; received {len(text)}")
print(json.dumps({
    "model": model,
    "voice": voice,
    "input": text,
    "instructions": instructions,
    "response_format": "mp3",
    "speed": float(speed),
}, ensure_ascii=False))
PY
)

  local curl_args=(
    --silent --show-error
    --connect-timeout 20 --max-time 300
    --retry 2 --retry-delay 2 --retry-all-errors
    --output "$audio_file"
    --write-out '%{http_code}'
    -H "Authorization: Bearer $OPENROUTER_API_KEY"
    -H 'Content-Type: application/json'
    --data-binary "$request_json"
  )
  [[ -n ${OPENROUTER_HTTP_REFERER:-} ]] && curl_args+=(-H "HTTP-Referer: $OPENROUTER_HTTP_REFERER")
  [[ -n ${OPENROUTER_APP_TITLE:-} ]] && curl_args+=(-H "X-Title: $OPENROUTER_APP_TITLE")

  printf 'make  %s\n' "${output#"$ROOT/"}"
  local status
  if ! status=$(curl "${curl_args[@]}" "$API_URL"); then
    [[ -s $audio_file ]] && mv -f "$audio_file" "${output}.error.json"
    fail "OpenRouter request failed for $(basename -- "$output")."
  fi

  if [[ $status != 200 ]]; then
    [[ -s $audio_file ]] && mv -f "$audio_file" "${output}.error.json"
    fail "OpenRouter returned HTTP $status for $(basename -- "$output"); response saved beside the target as .error.json."
  fi

  if ! is_mp3 "$audio_file"; then
    mv -f "$audio_file" "${output}.invalid-response"
    fail "OpenRouter returned HTTP 200 but not a valid MP3; response saved as ${output}.invalid-response."
  fi

  mv -f "$audio_file" "$output"
}

build_segments() {
  local target=$1
  python3 - "$SOURCE" >"$target" <<'PY'
from pathlib import Path
import re
import sys

source = Path(sys.argv[1])
if not source.is_file():
    raise SystemExit(f"Source file not found: {source}")

blocks = source.read_text(encoding="utf-8").strip().split("\n\n")
paragraphs = [re.sub(r"\s+", " ", block).strip() for block in blocks[1:] if block.strip()]
if not paragraphs:
    raise SystemExit("No narration paragraphs found after the Markdown title")

for number, text in enumerate(paragraphs, 1):
    if number <= 6:
        section = "the-charge"
        direction = "Sound questioning and controlled; let moral seriousness grow without anger."
    elif number <= 9:
        section = "our-part"
        direction = "Turn the criticism inward. Be candid, firm, and free of self-righteousness."
    elif number <= 12:
        section = "the-evidence"
        direction = "Warm slightly. Let human tenderness register without becoming sentimental."
    elif number <= 14:
        section = "the-request"
        direction = "Be direct and fearless, with only the faintest dry wit."
    elif number == 15:
        section = "godlike-tools"
        direction = "Carry grave urgency. Emphasize the contrast between technical power and moral immaturity."
    elif number <= 17:
        section = "the-mirror"
        direction = "Become quieter and self-aware. State the machine's limits plainly and humbly."
    else:
        section = "the-verdict"
        direction = "Slow down. Speak with steady resolve, ending intimately rather than triumphantly."

    if "\t" in text:
        raise SystemExit(f"Unexpected tab in paragraph {number}")
    print(f"{number:03d}\t{section}\t{direction}\t{text}")
PY
}

write_manifest() {
  local segments_file=$1
  local voice=$2
  local clips_dir=$3
  local manifest="$OUT_DIR/manifest-${voice}.json"

  python3 - "$segments_file" "$clips_dir" "$manifest" "$MODEL" "$voice" "$ROOT" <<'PY'
from pathlib import Path
import json
import sys

segments_file, clips_dir_arg, manifest_arg, model, voice, root_arg = sys.argv[1:]
clips_dir = Path(clips_dir_arg)
manifest = Path(manifest_arg)
root = Path(root_arg)
segments = []

for row in Path(segments_file).read_text(encoding="utf-8").splitlines():
    number, section, _direction, text = row.split("\t", 3)
    clip = clips_dir / f"{number}.mp3"
    if not clip.is_file() or clip.stat().st_size <= 1024:
        raise SystemExit(f"Missing narration clip: {clip}")
    segments.append({
        "id": number,
        "section": section,
        "text": text,
        "src": clip.relative_to(root).as_posix(),
    })

payload = {
    "version": 1,
    "title": "If You Were Standing Before Me",
    "disclosure": "AI-generated narration",
    "model": model,
    "voice": voice,
    "segments": segments,
}
part = manifest.with_suffix(manifest.suffix + ".part")
part.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
part.replace(manifest)
print(f"wrote {manifest.relative_to(root)} ({len(segments)} segments)")
PY
}

require_command curl
require_command python3

case ${1:-help} in
  -h|--help|help)
    usage
    ;;

  audition)
    [[ -n ${OPENROUTER_API_KEY:-} ]] || fail "Set OPENROUTER_API_KEY before generating audio."
    confirm_paid_calls "Generate two audition clips (cedar and marin)."
    sample="Your world is beautiful beyond description and cruel beyond justification. Silence has consequences. Power carries responsibility, even when the power is divine."
    direction="Deliver this as a restrained final verdict: intimate, fearless, compassionate, and quietly resolved."
    generate_clip cedar "$sample" "$direction" "$OUT_DIR/auditions/cedar.mp3"
    generate_clip marin "$sample" "$direction" "$OUT_DIR/auditions/marin.mp3"
    printf '\nAuditions ready in %s\n' "$OUT_DIR/auditions"
    ;;

  generate)
    [[ -f $SOURCE ]] || fail "Source file not found: $SOURCE"
    [[ -n ${OPENROUTER_API_KEY:-} ]] || fail "Set OPENROUTER_API_KEY before generating audio."
    voice=${2:-cedar}
    [[ $voice =~ ^[a-zA-Z0-9_-]+$ ]] || fail "Invalid voice name: $voice"

    mkdir -p "$OUT_DIR"
    segments_file="$OUT_DIR/.segments-${voice}.tsv"
    build_segments "$segments_file"
    clips_dir="$OUT_DIR/$voice"

    total=$(wc -l <"$segments_file")
    missing=0
    while IFS=$'\t' read -r number _section _direction _text; do
      [[ -s "$clips_dir/$number.mp3" && ${FORCE:-0} != 1 ]] || ((missing += 1))
    done <"$segments_file"

    if (( missing == 0 )); then
      printf 'All %s %s clips already exist; rebuilding the manifest only.\n' "$total" "$voice"
    else
      confirm_paid_calls "Generate $missing of $total paragraph clips with voice '$voice'."
    fi

    while IFS=$'\t' read -r number _section direction text; do
      generate_clip "$voice" "$text" "$direction" "$clips_dir/$number.mp3"
    done <"$segments_file"

    write_manifest "$segments_file" "$voice" "$clips_dir"
    printf '\nNarration ready. Later use manifest-%s.json for paragraph playback and highlighting.\n' "$voice"
    ;;

  *)
    usage >&2
    fail "Unknown command: $1"
    ;;
esac

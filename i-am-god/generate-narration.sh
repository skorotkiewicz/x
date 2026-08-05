#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SOURCE=${SOURCE:-"$ROOT/message-to-god.md"}
OUT_DIR=${OUT_DIR:-"$ROOT/assets/narration"}
API_URL=${OPENROUTER_TTS_URL:-"https://openrouter.ai/api/v1/audio/speech"}
MODEL=${OPENROUTER_TTS_MODEL:-"fish-audio/s2.1-pro-free:free"}
PROFILE=fish-s2.1

usage() {
  cat <<'EOF'
Generate AI narration for “Dear God, We Need to Talk” through OpenRouter.

Usage:
  ./generate-narration.sh audition
  ./generate-narration.sh generate

Commands:
  audition  Generate the same short sample in two Fish S2.1 delivery styles.
  generate  Generate one MP3 per letter paragraph and
            assets/narration/manifest-fish-s2.1.json.

Required:
  OPENROUTER_API_KEY  OpenRouter API key. Keep it in your environment.

Optional environment variables:
  YES=1                       Skip the API-call confirmation.
  FORCE=1                     Replace existing clips.
  OUT_DIR=/path               Output directory.
  OPENROUTER_TTS_MODEL=...    Override the model ID.
  OPENROUTER_HTTP_REFERER=... Optional OpenRouter attribution URL.
  OPENROUTER_APP_TITLE=...    Optional OpenRouter attribution title.

Examples:
  export OPENROUTER_API_KEY='...'
  ./generate-narration.sh audition
  ./generate-narration.sh generate
  YES=1 ./generate-narration.sh generate

The default Fish Audio model is currently free on OpenRouter. Existing files
are skipped unless FORCE=1. OpenRouter exposes its provider-default voice;
delivery style is controlled with Fish S2.1 inline cues.
EOF
}

fail() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

confirm_api_calls() {
  local description=$1
  [[ ${YES:-0} == 1 ]] && return
  [[ -t 0 ]] || fail "Confirmation required for external API calls. Review the command, then rerun with YES=1."
  printf '%s Continue? [y/N] ' "$description"
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
  local text=$1
  local cue=$2
  local output=$3

  if [[ -s $output && ${FORCE:-0} != 1 ]]; then
    printf 'skip  %s\n' "${output#"$ROOT/"}"
    return
  fi

  mkdir -p "$(dirname -- "$output")"
  local audio_file="${output}.audio.part"
  local request_json

  request_json=$(python3 - "$MODEL" "$cue" "$text" <<'PY'
import json
import sys

model, cue, text = sys.argv[1:]
styled_input = f"{cue} {text}"
if not text or len(styled_input) > 4096:
    raise SystemExit(f"TTS input must contain 1–4096 characters; received {len(styled_input)}")
print(json.dumps({
    "model": model,
    "input": styled_input,
    "response_format": "mp3",
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
        cue = "[calm, intimate, measured, quietly questioning, restrained]"
    elif number <= 9:
        section = "our-part"
        cue = "[candid, firm, self-reflective, restrained, without self-righteousness]"
    elif number <= 12:
        section = "the-evidence"
        cue = "[warm, compassionate, quietly hopeful, unsentimental]"
    elif number <= 14:
        section = "the-request"
        cue = "[direct, fearless, controlled, with very subtle dry wit]"
    elif number == 15:
        section = "godlike-tools"
        cue = "[grave, urgent, deliberate, emphasizing moral contrast]"
    elif number <= 17:
        section = "the-mirror"
        cue = "[quiet, humble, self-aware, intimate, unhurried]"
    else:
        section = "the-verdict"
        cue = "[slow, steady, intimate, compassionate, quietly resolved, not triumphant]"

    if "\t" in text:
        raise SystemExit(f"Unexpected tab in paragraph {number}")
    print(f"{number:03d}\t{section}\t{cue}\t{text}")
PY
}

write_manifest() {
  local segments_file=$1
  local clips_dir=$2
  local manifest="$OUT_DIR/manifest-${PROFILE}.json"

  python3 - "$segments_file" "$clips_dir" "$manifest" "$MODEL" "$ROOT" <<'PY'
from pathlib import Path
import json
import sys

segments_file, clips_dir_arg, manifest_arg, model, root_arg = sys.argv[1:]
clips_dir = Path(clips_dir_arg)
manifest = Path(manifest_arg)
root = Path(root_arg)
segments = []

for row in Path(segments_file).read_text(encoding="utf-8").splitlines():
    number, section, _cue, text = row.split("\t", 3)
    clip = clips_dir / f"{number}.mp3"
    if not clip.is_file() or clip.stat().st_size <= 1024:
        raise SystemExit(f"Missing narration clip: {clip}")
    try:
        src = clip.relative_to(root).as_posix()
    except ValueError:
        src = clip.relative_to(manifest.parent).as_posix()
    segments.append({"id": number, "section": section, "text": text, "src": src})

payload = {
    "version": 1,
    "title": "If You Were Standing Before Me",
    "disclosure": "AI-generated narration",
    "model": model,
    "voice": "provider-default",
    "style_control": "Fish Audio S2.1 inline cues",
    "segments": segments,
}
part = manifest.with_suffix(manifest.suffix + ".part")
part.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
part.replace(manifest)
try:
    shown = manifest.relative_to(root)
except ValueError:
    shown = manifest
print(f"wrote {shown} ({len(segments)} segments)")
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
    confirm_api_calls "Generate two free-model audition clips with different delivery cues."
    sample="Your world is beautiful beyond description and cruel beyond justification. Silence has consequences. Power carries responsibility, even when the power is divine."
    generate_clip "$sample" "[calm, intimate, measured, compassionate, quietly resolved]" "$OUT_DIR/auditions/restrained.mp3"
    generate_clip "$sample" "[grave, fearless, deliberate, emotionally restrained, ending softly]" "$OUT_DIR/auditions/grave.mp3"
    printf '\nAuditions ready in %s\n' "$OUT_DIR/auditions"
    ;;

  generate)
    [[ -z ${2:-} ]] || fail "Fish Audio uses its provider-default voice; run 'generate' without a voice argument."
    [[ -f $SOURCE ]] || fail "Source file not found: $SOURCE"
    [[ -n ${OPENROUTER_API_KEY:-} ]] || fail "Set OPENROUTER_API_KEY before generating audio."

    mkdir -p "$OUT_DIR"
    segments_file="$OUT_DIR/.segments-${PROFILE}.tsv"
    build_segments "$segments_file"
    clips_dir="$OUT_DIR/$PROFILE"

    total=$(wc -l <"$segments_file")
    missing=0
    while IFS=$'\t' read -r number _section _cue _text; do
      [[ -s "$clips_dir/$number.mp3" && ${FORCE:-0} != 1 ]] || ((missing += 1))
    done <"$segments_file"

    if (( missing == 0 )); then
      printf 'All %s Fish S2.1 clips already exist; rebuilding the manifest only.\n' "$total"
    else
      confirm_api_calls "Generate $missing of $total paragraph clips with the free Fish S2.1 model."
    fi

    while IFS=$'\t' read -r number _section cue text; do
      generate_clip "$text" "$cue" "$clips_dir/$number.mp3"
    done <"$segments_file"

    write_manifest "$segments_file" "$clips_dir"
    printf '\nNarration ready. Later use manifest-%s.json for paragraph playback and highlighting.\n' "$PROFILE"
    ;;

  *)
    usage >&2
    fail "Unknown command: $1"
    ;;
esac

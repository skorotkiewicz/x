#!/usr/bin/env bash
set -euo pipefail

if (( $# > 1 )); then
  echo "Usage: $0 [output.mp4]" >&2
  exit 2
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd -- "$script_dir/.." && pwd)"
audio="$project_dir/Whimsical Folk Ballad of the Demons.m4a"
subtitles="$project_dir/scribes/Whimsical Folk Ballad of the Demons.srt"
output="${1:-$script_dir/Whimsical Folk Ballad of the Demons v2.mp4}"

for command in ffmpeg ffprobe; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

for input in "$audio" "$subtitles"; do
  [[ -f "$input" ]] || {
    echo "Missing input: $input" >&2
    exit 1
  }
done

[[ ! -e "$output" ]] || {
  echo "Refusing to overwrite existing output: $output" >&2
  exit 1
}

duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$audio")"
[[ "$duration" =~ ^[0-9]+([.][0-9]+)?$ ]] || {
  echo "Could not determine audio duration" >&2
  exit 1
}

duration_whole="${duration%%.*}"
(( duration_whole > 3 )) || {
  echo "Audio is too short for the closing fade" >&2
  exit 1
}
fade_out=$((duration_whole - 3))

text_font="DejaVu Serif"
symbol_font="Noto Sans Symbols 2"
choruses="between(t,23.8,44.4)+between(t,66.0,85.5)+between(t,128.9,148.3)+between(t,213.8,228.2)"

background="gradients=size=1920x1080:rate=30:duration=$duration"
background+=":c0=0x07131f:c1=0x12353a:c2=0x61414d:c3=0xb87555:c4=0xefd49a"
background+=":nb_colors=5:type=linear:speed=0.004"

subtitle_style="FontName=$text_font,FontSize=16,PrimaryColour=&H00EAF6FF"
subtitle_style+=",OutlineColour=&H0020150D,BackColour=&H78130D09"
subtitle_style+=",BorderStyle=3,Outline=1,Shadow=0,Alignment=2"
subtitle_style+=",MarginL=20,MarginR=20,MarginV=20,Spacing=0.4"

# Color direction follows the story: home, danger, secret, time, departure, spring.
filters="drawbox=x=0:y=0:w=iw:h=ih:color=0xd49a60@0.08:t=fill:enable='$choruses'"
filters+=",drawbox=x=0:y=0:w=iw:h=ih:color=0x4a0e1d@0.25:t=fill:enable='between(t,87.8,112.4)'"
filters+=",drawbox=x=0:y=0:w=iw:h=ih:color=0x241342@0.23:t=fill:enable='between(t,112.4,150.8)'"
filters+=",drawbox=x=0:y=0:w=iw:h=ih:color=0x102d46@0.20:t=fill:enable='between(t,150.8,175.5)'"
filters+=",drawbox=x=0:y=0:w=iw:h=ih:color=0xd2924e@0.12:t=fill:enable='between(t,175.5,213.8)'"
filters+=",drawbox=x=0:y=0:w=iw:h=ih:color=0x4f7e45@0.20:t=fill:enable='between(t,228.2,$duration)'"
filters+=",noise=alls=3:allf=a+p,vignette=PI/5"

# The gate remains as a quiet visual frame until the journey begins.
filters+=",drawbox=x=105:y=145:w=145:h=735:color=0x05080d@0.34:t=fill:enable='between(t,0,175.5)'"
filters+=",drawbox=x=1670:y=145:w=145:h=735:color=0x05080d@0.34:t=fill:enable='between(t,0,175.5)'"
filters+=",drawbox=x=250:y=145:w=1420:h=48:color=0x05080d@0.30:t=fill:enable='between(t,0,175.5)'"
filters+=",drawbox=x=62:y=48:w=iw-124:h=ih-96:color=0xf6d69a@0.15:t=2"

# Opening card.
filters+=",drawtext=font='$text_font':text='AT BLACKTHORN GATE'"
filters+=":fontcolor=0xffe8bc:fontsize=102:x=(w-text_w)/2:y=h*0.28"
filters+=":borderw=2:bordercolor=0x1c120c@0.75:enable='between(t,0.4,6.9)'"
filters+=",drawtext=font='$text_font':text='THREE DEMONS AND A BABY'"
filters+=":fontcolor=0xffe8bc@0.84:fontsize=34:x=(w-text_w)/2:y=h*0.43"
filters+=":enable='between(t,1.0,6.9)'"
filters+=",drawtext=font='$symbol_font':text='❦'"
filters+=":fontcolor=0xf4ca80@0.75:fontsize=62:x=(w-text_w)/2:y=h*0.51"
filters+=":enable='between(t,1.4,6.9)'"

# A tiny running title anchors the changing chapters.
filters+=",drawtext=font='$text_font':text='AT BLACKTHORN GATE'"
filters+=":fontcolor=0xffe4af@0.42:fontsize=23:x=(w-text_w)/2:y=42"
filters+=":enable='between(t,7.1,235.2)'"

add_chapter() {
  local start="$1" end="$2" title="$3"
  filters+=",drawtext=font='$text_font':text='$title'"
  filters+=":fontcolor=0xffe3ad@0.86:fontsize=31:x=(w-text_w)/2:y=92"
  filters+=":borderw=1:bordercolor=0x160f0a@0.65:enable='between(t,$start,$end)'"
}

add_chapter 7.1 12.0 "I  ·  THE BASKET"
add_chapter 49.8 54.8 "II  ·  THE GATEHOUSE"
add_chapter 87.8 93.0 "III  ·  THE RIDERS"
add_chapter 112.3 117.6 "IV  ·  THE RED THREAD"
add_chapter 151.1 156.4 "V  ·  SIXTEEN SPRINGS"
add_chapter 175.4 180.8 "VI  ·  THE ROAD OPENS"
add_chapter 228.7 234.0 "VII  ·  THE PEACH TREE"

# Story motifs: cradle, unlikely family, chorus lights, riders, crown, years, journey, tree.
filters+=",drawtext=font='$symbol_font':text='∪':fontcolor=0xf3bd78@0.24"
filters+=":fontsize=360:x=(w-text_w)/2:y=235:enable='between(t,7.0,23.8)'"
filters+=",drawtext=font='$symbol_font':text='•':fontcolor=0xffedc9@0.34"
filters+=":fontsize=150:x=(w-text_w)/2:y=355:enable='between(t,7.0,23.8)'"

filters+=",drawtext=font='$symbol_font':text='♠     ♠     ♠':fontcolor=0xe8b974@0.25"
filters+=":fontsize=126:x=(w-text_w)/2:y=255:enable='between(t,49.8,66.0)'"
filters+=",drawtext=font='$symbol_font':text='•':fontcolor=0xffedc9@0.40"
filters+=":fontsize=100:x=(w-text_w)/2:y=440:enable='between(t,49.8,66.0)'"

filters+=",drawtext=font='$symbol_font':text='✦       ✦       ✦':fontcolor=0xffd985@0.65"
filters+=":fontsize=68:x=(w-text_w)/2:y=208:alpha='0.45+0.20*sin(t*3)'"
filters+=":enable='$choruses'"

filters+=",drawtext=font='$symbol_font':text='♞    ♞    ♞':fontcolor=0x1c0b12@0.70"
filters+=":fontsize=152:x=(w+250)-(t-87.8)*118:y=285+12*sin(t*2)"
filters+=":shadowx=5:shadowy=7:shadowcolor=0xd39761@0.35:enable='between(t,87.8,107.2)'"

filters+=",drawbox=x=385:y=215:w=1150:h=390:color=0xf2d39a@0.13:t=fill:enable='between(t,112.3,128.8)'"
filters+=",drawbox=x=385:y=215:w=1150:h=390:color=0xffe4ad@0.28:t=2:enable='between(t,112.3,128.8)'"
filters+=",drawtext=font='$symbol_font':text='♛':fontcolor=0xf5ca75@0.48"
filters+=":fontsize=122:x=(w-text_w)/2:y=250:enable='between(t,112.3,128.8)'"
filters+=",drawtext=font='$text_font':text='KEEP HER FROM THE CROWN'"
filters+=":fontcolor=0xffe9c4@0.76:fontsize=37:x=(w-text_w)/2:y=425:enable='between(t,115.0,128.8)'"
filters+=",drawtext=font='$text_font':text='UNTIL THE CROWN IS HERS'"
filters+=":fontcolor=0xffe9c4@0.76:fontsize=37:x=(w-text_w)/2:y=478:enable='between(t,115.0,128.8)'"

filters+=",drawtext=font='$text_font':text='XVI':fontcolor=0xc9dff1@0.18"
filters+=":fontsize=390:x=(w-text_w)/2:y=210:enable='between(t,151.0,175.5)'"

filters+=",drawtext=font='$symbol_font':text='♛   ♠   ♠   ♠':fontcolor=0xffd28a@0.48"
filters+=":fontsize=116:x=-620+(t-175.4)*56:y=300+14*sin(t*1.4)"
filters+=":shadowx=4:shadowy=6:shadowcolor=0x18210f@0.55:enable='between(t,175.4,229.0)'"

filters+=",drawtext=font='$symbol_font':text='♣':fontcolor=0x91bd65@0.68"
filters+=":fontsize='min(350,80+(t-228.7)*27)':x=(w-text_w)/2:y=650-text_h"
filters+=":shadowx=5:shadowy=7:shadowcolor=0x18200e@0.65:enable='between(t,228.7,$duration)'"
filters+=",drawtext=font='$symbol_font':text='✦   ✦   ✦   ✦   ✦':fontcolor=0xffd98a@0.48"
filters+=":fontsize=42:x=(w-text_w)/2:y=220+14*sin(t*1.7):enable='between(t,228.7,$duration)'"
filters+=",drawtext=font='$text_font':text='HOME IS WHO WALKS BESIDE YOU'"
filters+=":fontcolor=0xffe9c4@0.88:fontsize=37:x=(w-text_w)/2:y=770"
filters+=":enable='between(t,235.4,239.7)'"

# Captions remain foreground elements and use the trusted transcription timing.
filters+=",subtitles=filename='$subtitles':original_size=1920x1080:force_style='$subtitle_style'"
filters+=",fade=t=in:st=0:d=1.2,fade=t=out:st=$fade_out:d=3,format=yuv420p"

# Organic light flecks and a low golden waveform keep every section moving with the music.
graph="life=size=320x180:rate=30:ratio=0.08:seed=917:mold=4"
graph+=":life_color=0xf4d180:death_color=0x000000:mold_color=0x355842"
graph+=",scale=1920:1080:flags=bilinear,gblur=sigma=2.2,format=yuv420p[fireflies];"
graph+="[1:a]showwaves=size=1920x280:mode=cline:colors=0xf6d48a|0xd88662"
graph+=":scale=sqrt:rate=30,pad=1920:1080:0:520:color=black,format=yuv420p[wave];"
graph+="[0:v][fireflies]blend=all_mode=screen:all_opacity=0.075[sparked];"
graph+="[sparked][wave]blend=all_mode=screen:all_opacity=0.19,$filters[video]"

ffmpeg -hide_banner -n \
  -f lavfi -i "$background" \
  -i "$audio" \
  -filter_complex "$graph" \
  -map "[video]" -map 1:a:0 \
  -c:v libx264 -preset slow -crf 18 -tune film -profile:v high -level:v 4.1 \
  -c:a copy \
  -shortest -movflags +faststart -max_muxing_queue_size 1024 \
  -metadata title="At Blackthorn Gate — Storybook Music Video" \
  -metadata comment="Procedural visuals synchronized to the song and transcription" \
  "$output"

printf 'Created %s\n' "$output"

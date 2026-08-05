# Music Generator Instructions for “At Blackthorn Gate”

## Generator Setup

| Control | Setting |
|---|---|
| Generation | **Cloud** |
| Model | **ACE-Step V1.5 XL Turbo** |
| Mode | **Custom** |
| Duration | **240 seconds** |
| Tempo | **104 BPM** |
| Time signature | **6** (use as a lilting 6/8 feel) |
| Key | **D major** |
| Reference audio | **None** |
| Thinking | **On** |
| Creative–Robust balance | **About 70% toward Robust** |

Use the maximum duration because the song has many narrative verses. Keep the intro, transitions, and outro short so the complete lyric fits.

## Lyrics Field

Copy the lyrics from `SONG.txt` into the **Lyrics** field, with these formatting changes:

## Prompt Field

Paste this into the **Prompt** field:

```text
A whimsical storybook folk ballad with warmth, subtle humor, and genuine emotional weight. Lilting 6/8 rhythm at 104 BPM in D major, with brief modal and relative-minor shading during the riders, hidden-message, and bridge sections. Warm, expressive lead vocal with exceptionally clear diction and lightly theatrical narrative phrasing, suitable for all ages but never childish or cartoonish.

Begin immediately with intimate fingerpicked acoustic guitar and a soft solo vocal. Add mandolin, gentle fiddle, upright bass, brushed frame drum, and occasional accordion or celesta accents. Keep the verses nimble and conversational so the full story fits. Let each chorus open naturally into warm three-part backing harmonies, suggesting the three demons without using character voices. The melody should be memorable, tender, and easy to follow.

Build the arrangement with the story: homely and curious in verses 1 and 2; slightly darker and more urgent when the royal riders arrive; hushed and mysterious for the rosemary message; sparse and emotionally exposed at the bridge; then bright, full, and hopeful for the final verse and altered final chorus. Give “Three demons, one queen, and all of them home” a small musical lift. End gently on the peach-tree couplet with fiddle, celesta, and one warm resolved chord.

Use concise transitions, no instrumental solo, no long intro, and no extended outro. Preserve all lyrics and prioritize reaching the final couplet within four minutes. Organic acoustic production, close natural vocal, restrained reverb, broad but not bombastic dynamics.
```

## Negative Styles Field

Paste this into **Negative Styles**:

```text
heavy metal, hard rock, EDM, trap, synthwave, glossy dance-pop, bombastic trailer music, horror soundtrack, operatic singing, musical-theater belting, comedy parody, novelty children’s song, cartoon voices, demon growls, screaming, rap, spoken-word delivery, excessive vibrato, excessive reverb, long instrumental intro, instrumental solos, extended outro, abrupt cutoff
```

## Expected Shape

- **Opening:** Almost immediate vocal; intimate and curious.
- **Early choruses:** Gentle expansion, with warm harmony rather than a large anthem.
- **Riders:** Brief tension from lower fiddle, firmer drum, and minor shading.
- **Hidden message:** Pull back the accompaniment and emphasize the lyric clearly.
- **Bridge:** Quietest and most vulnerable section.
- **Final verse and chorus:** Fullest arrangement, hopeful rather than triumphant.
- **Coda:** Drop back to a delicate finish on the peach tree.

If the generated performance cuts off before the coda, keep all settings but raise the tempo to **110 BPM** and add this sentence to the end of the prompt: “Sing the narrative lines briskly and use no instrumental gaps between sections.”

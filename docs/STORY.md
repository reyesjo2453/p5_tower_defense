# ENCORE PROTOCOL: story bible (spoilers)

An original story for this fan showcase. The scene text lives in `src/story/script.js`; this page
is the outline and the reasoning behind it.

## Premise

Every night at 11:59, every screen in the city plays the same four-minute stream: a stage, a
spotlight and the word ENCORE. 312 people have watched it to the end, and none of them have woken
up. The cognitive theater behind the stream is the Encore Palace.

## Cast

| Codename | Role | Who they are |
|---|---|---|
| JESTER | Leader | Wakes on stage in a mask with no memory. Really **Kei Amane**, 17. |
| QUEEN | Vanguard | An investigator who has tracked the stream for forty days and came to steal the Treasure. |
| ORACLE | Tactician | A remote hacker who traced the signal to a hospital bed: Ward 3, Room 12. |
| PROMPTER | Support | The cat in the prompt box who "remembers the lines." Really the memories Jester cut out of himself. |
| LIMELIGHT | Caster | The star from the poster. Really what is left of **Hikari Amane**, Kei's sister, and the Treasure itself. |
| THE AUDIENCE / THE IMPRESARIO | Ruler | Everyone who wouldn't stop watching, stitched into one shape. |

## Stage beats (fifteen stages, 3–5 waves each)

| # | Stage | Joins / unlocks | Beat |
|---|---|---|---|
| 1 | PROLOGUE · Places, Please | Jester · posture, 1-MORE | A voice from the prompt box: "You've forgotten your line *again*." |
| 2 | SCENE I · Opening Night | Rank-ups | A broken Shadow drops a hospital bracelet: Ward 3. "Your hands will remember steps your head never learned." |
| 3 | SCENE II · No One | Persona summons | Jester's Persona rises with a blank mask. It has no name because he doesn't. |
| 4 | SCENE III · Unscripted | Queen · Baton Pass | The Shadows aren't the ruler's guards. They want the Treasure too. |
| 5 | SCENE IV · Two Doors | (second lane) | The set rebuilds itself between scenes. Somebody is changing the stage. |
| 6 | SCENE V · House Lights (ACT II) | Oracle · marks | The signal comes from Room 312, and the Palace has no ruler signature. |
| 7 | SCENE VI · Crosstalk | — | Queen's brother Ren is a sleeper. Oracle has watched ENCORE every night and always skips the last ten seconds: she's in the audience too. |
| 8 | SCENE VII · The Prompt Box | Prompter | **The night loops.** This is performance #46+, and they've never gotten this far. |
| 9 | SCENE VIII · The Green Room | — | A photo of two kids with sparklers, one face scratched out. A Persona is the face you can stand to look at. |
| 10 | SCENE IX · Understudy | Limelight · All-Out | The girl from the stream steps out of the burning poster. |
| 11 | SCENE X · Dress Rehearsal (ACT III) | Blocking | The script is found: "Written and directed by JESTER", stage directions included, so they stop standing where it says. |
| 12 | SCENE XI · Strike the Set | — | The Prompter is Jester's excised memory. Kei caused Hikari's fall. The Shadows are the 312 sleepers. NO ONE becomes **HARLEQUIN**. |
| 13 | SCENE XII · Room 312 | (third lane) | The hospital camera: Kei's body sits by Hikari's bed, pressing play. Ren is in the next bed. |
| 14 | SCENE XIII · The Music Box | — | The box is empty: Limelight *is* the Treasure. "Guard me one more time, and then let me go." |
| 15 | FINALE · Curtain Call | — | The Audience rises as the Impresario. "You never wrote an ending." "Then I'll improvise." |
| — | Ending | — | Hikari wakes, and Kei finally sleeps. Three nights later the stream returns: *starring THE PHANTOM SHOWCASE. Viewers: 1.* "Do you want an encore?" |

## Personas

| Phantom | Persona | Mask | Skill |
|---|---|---|---|
| Jester | NO ONE → HARLEQUIN | a blank domino; after Strike the Set, a cracked grin mended with gold | Curtain Wind: pushes a crowd back down the runway |
| Queen | VERDICT | a visor under a three-point crown | Gavel Drop: stun + posture damage |
| Oracle | SIGHTLINE | one great lens | Spotlight: marks a whole crowd |
| Prompter | GHOSTLIGHT | a lantern cage with a flame for a mouth | patches and wards the Treasure |
| Limelight | FLASHPAPER | a crown of flame | Wall of Fire: a burning ring that lingers |

## The mechanics are the story

- **Loss = the loop.** The Treasure falls, the clock resets to 11:59 and the chapter restarts "from
  the top." The performance counter (`save.perf`) never resets, not even across new games.
- **Posture break = unmasking.** Each Shadow you break is a sleeper remembering it has somewhere to be.
- **1-MORE / Baton Pass**: "a good show is a relay."
- **Rank-ups**: rehearsals the body remembers from the earlier loops.
- **Blocking**: stop standing where you stood last time.
- **Prompter's heal**: someone patching the set between cues.
- **Personas**: the face you can stand to look at. Jester's stays blank until he remembers.
- **Generated stages**: the stagehands rebuild the set between scenes.
- **Blocking**: the script even says where to stand; moving is refusing it.
- **ENCORE on the win screen**: the player is the last member of the audience.

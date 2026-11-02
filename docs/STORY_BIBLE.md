# Story Bible: *Encore Protocol*

> Fan fiction set after the events of Persona 5. Everything below is original to this project.

## Premise

One summer after the Phantom Thieves changed Tokyo's heart, Ren Amamiya returns to the city.
Trains on the Ginza line stop. Commuters stand frozen, smiling, mouthing the same four bars of a song.
The song is **ENCORE**, a streaming app (nine million downloads in a month) that loops your happiest memory
forever. There is no Palace on the Metaverse map. Futaba's Nav reports a *new layer beneath Mementos*.

## Themes

- **Nostalgia as a trap.** Replaying a good memory is not the same as having lived it.
- **Carrying vs. looping.** Joker carries Akechi; he does not loop him.
- **The audience.** The most dangerous distortion is one everyone *asks* for.

## Tone & structure

AAA-style serialized "season" in chapters. Each chapter: cinematic open → dialogue scenes → 3–4 stages
with mid-battle beats → boss → emotional beat → hook.

## Original cast

| Character | Role |
| --- | --- |
| **Mio Tachibana** | Teen DJ. Asks the Thieves for help; secretly **Mio Kuga**, Soren's daughter. |
| **Sora Tachibana** | Mio's older brother and a young producer. Found Soren's unfinished tapes and uploaded them as ENCORE without knowing what they were. First victim. |
| **Soren Kuga, "The Maestro"** | Composer who died in a studio fire 11 years ago. His regret (never finishing his daughter's lullaby) seeded ENCORE. Rules the *Encore Theatre* Palace. Sympathetic villain, **but only the opening act**. |
| **The Echoes** | Cognitive replays of regret: Loop Echo, Skip Hound, Wall of Sound, Mute Seer, Conductor Echo. |
| **The Audience** *(hook for Ch. 2)* | The collective wish to replay the past. ENCORE was a request, not an invention. |

## Chapter 1: REPLAY (playable now)

| Beat | Scene id | Summary |
| --- | --- | --- |
| Prologue | `opening` | Cinematic. Ren, Morgana, then Futaba's emergency call. The trains have stopped. |
| 1-1 | `1-1.pre / mid / post` | Platform Zero. Mio asks for help. First Echoes. The Maestro's voice on the PA. Fox arrives. |
| 1-2 | `1-2.pre / mid / mid2 / post` | The tunnel is a bar of music. Ryuji's worst day replays: "You didn't fix it. You got up." Haru traces Kuga Acoustics, discovers Mio's real surname. |
| 1-3 | `1-3.pre / conductor / mid / encore / post` | Encore Theatre. Makoto's case files. The Maestro confronts Joker about the empty chair at his table. Boss revives with "ENCORE!". His confession; the twist: the signal comes from inside every phone. |

### Hook

> *"The wish to replay isn't something he made. He just gave it a stage."*

Chapter 2 (planned) follows the signal to the next door and the Thieves who have not yet been
"requested": Akechi's unresolved echo, Sae, Sojiro, and whoever Joker left behind in Tokyo.

## Continuity notes

- Persona canon respected: Phantom Thieves roster, personas, the Metaverse/Mementos vocabulary.
- Original additions are marked as such and avoid contradicting the main story.
- Joker is canonically silent in the original game; here he speaks sparingly and with intent.

## Scripting format

Scripts live in `src/data/story.js` as arrays of steps (`say`, `narr`, `enter`, `exit`, `bg`, `fx`,
`cine`, `music`, `card`, `wait`, `sfx`). `tests/data.test.js` validates every speaker, background and
cinematic exists, so typos fail CI instead of crashing mid-scene.

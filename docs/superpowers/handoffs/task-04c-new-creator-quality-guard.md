# Task 04C: New Creator Import Quality Guard

## Root Cause

The local enrichment classifier is intentionally keyword-heavy. For newly imported Instagram creators, that let obvious non-demo captions pass whenever they included terms like `run`, `row`, `workout`, or `coach` in class promos, lifestyle posts, or hashtags. Follow-up audit also found that broad instruction signals could override non-demo patterns when normal prose contained words like `goals set`, `make sure to post`, table `set up`, `drive me crazy`, or generic `how to keep your...` phrasing.

Legacy `coachingotf` data has a separate correction pass in `scripts/apply_corrections.py`, so this guard is scoped away from that creator to avoid changing existing legacy behavior before PR3.

## Guard Scope

Changed `scripts/enrich_local.py` to add an early non-demo guard for records where:

- `source == "instagram"`
- `creator.id` is present
- `creator.id != "coachingotf"`

The guard runs before `is_exercise_demo()` can mark the record as a demo. TikTok records and legacy `coachingotf` Instagram records skip this path.

## Rejected Examples

The new guard rejects narrow classes of obvious non-demos:

- Studio scheduling and promos: `prebook`, `book your class/session`, spots available, class times, `come see me/us`, `who will I see`, classes back on schedule, playlist/theme party announcements.
- Contextual studio/class announcements without exercise instruction: tomorrow-based challenge prompts, `who's ready` / `who's coming`, `don't miss`, `book into`, OTF friends/crew/studio notices, template/cookie-exchange announcements, Tread 50 promos, Orange Lights promos, heart-rate/rower technology notices, benchmark PR recaps, studio-week announcements, and studio-activity gag captions.
- OTF event/challenge announcements without exercise instruction: Transformation Challenge, Dri Tri, Capture The Flag, All Out with Aoki, Orange Everest, Marathon Month, Mayhem, Tornado, 12 Days of Fitness, Member Appreciation, benchmark/tomorrow class promos.
- Lifestyle/event posts: newborn/birth/labor/labour/postpartum announcements, narrow baby-arrival phrases, contextual pregnancy posts, wedding/proposal/travel recap/travel day/event recap posts, BJJ tournament/date night, self-defense date night, kids business / Muddy Buddies / Italian sodas.
- Nutrition, recipe, supplement, sponsor, and product promos: protein powder, oatmeal recipes, macros/calories around food, supplements, `sponsor me`, product promotion language, and link-in-bio CTAs.
- Non-directory sports content: `Day X/30 of making you a college basketball player`, basketball gameplay/open-gym/runs clips, pass/shot/layup captions, and follow-for-lifting-and-basketball-content CTAs when there is no clear exercise-instruction signal.
- Coach work-life/schedule posts and outdoor/lifestyle posts: opener/closing/clopen/silent-studio captions, PNW/couple/wood-chopping clips, and similar hashtag-driven lifestyle content.
- Hashtag-driven near-empty captions like `Helpful?`, `WE DID IT!`, and `Today was a big day` when exercise terms only appear in hashtags, including emoji and `Follow for more` filler before the hashtags.
- Generic fitness-adjacent posts without clear visible demo language: group-fitness endorsements, holiday motivation, rower battle recaps, goals/sustainability advice, coaching philosophy, school/job announcements, recruiting advice, and personal tribute captions.

Promo, nutrition/product, business, coach work-life, outdoor lifestyle, and most lifestyle patterns are unconditional import rejects. Event/challenge, studio-promo, and basketball gameplay patterns are contextual: they reject class announcements, challenge promos, recaps, studio notices, studio gag captions, and non-directory sports clips when there is no clear import instruction signal, but allow real TrainingTall tutorials that mention event names as context. Pregnancy is contextual so TrainingTall's rowing tutorial that mentions pregnancy as a form exception can still pass, and bare `baby` is not rejected because Austin uses it colloquially in real tutorials.

After explicit rejects, non-legacy Instagram imports now have a positive gate: if there is no clear import instruction signal, the visible caption body must still have demo-like exercise language, not just hashtags or generic fitness/lifestyle wording. The visible gate favors first-line/title style demo language such as named movements with `tips`, `form`, `technique`, `pain during`, `secret`, `fix`, etc.; row/run/treadmill language must be paired with visible tutorial/form/strategy/cue terms. This rejects generic fitness-adjacent posts even when they mention rower, treadmill, workout, coaching, strength, or fitness.

Instruction signals use explicit word-boundary tutorial phrases and exercise-context setup patterns; bare `set`, generic `make sure`, table `set up`, substring `form` in `Transformation`, `push` in `pushing`, `drive me crazy`, generic `how to keep your...`, and `coach` in lifestyle text do not create an escape hatch. The travel pattern is limited to recap/day language so exercise phrases like `distance to travel` do not trigger the lifestyle guard.

## Changed Files

- `scripts/enrich_local.py`
- `docs/superpowers/handoffs/task-04c-new-creator-quality-guard.md`

## Verification

Ran a targeted smoke with crafted records:

- `coachgarin` class promo with `Prebook now` and run/workout hashtags: guard `True`, demo `False`.
- `trainingtall` rowing benchmark tip with coaching cues: guard `False`, demo `True`.
- `coachingotf` short legacy caption: guard `False`, confirming the new path does not apply.
- `Transformation Challenge starts today #workout #run`: guard `True`, demo `False`.
- Newborn/birth caption with `pushing` plus workout-ish hashtags: guard `True`, demo `False`.
- `Day X/30 of making you a college basketball player`: guard `True`, demo `False`.
- Malformed creator values, legacy `coachingotf`, and TikTok records skip the new import guard.

Ran raw-sample verification from `raw_instagram_videos.json`:

- `https://www.instagram.com/reel/C_zNNWrpt3c/`: TrainingTall rowing tutorial with `pregnant` context is not an import-quality non-demo and enriches as an exercise demo.
- `https://www.instagram.com/reel/C_Rb5fxylHm/`: TrainingTall burpee tutorial with `distance to travel` is not an import-quality non-demo and enriches as an exercise demo.
- `https://www.instagram.com/reel/DPchoN3CSyh/`: TrainingTall upright row shoulder pain tutorial with colloquial `baby` is not an import-quality non-demo and enriches as an exercise demo.
- `https://www.instagram.com/reel/DKvcV7qvOua/`: TrainingTall deadlift hinge tutorial with colloquial `baby` is not an import-quality non-demo and enriches as an exercise demo.
- `https://www.instagram.com/reel/DKYSTgIJOEh/`: TrainingTall lunge pain tips with colloquial `baby` is not an import-quality non-demo and enriches as an exercise demo.
- `https://www.instagram.com/reel/C-1KAyiyxMX/`: TrainingTall running advice with colloquial `baby` is not an import-quality non-demo and enriches as an exercise demo.
- `https://www.instagram.com/reel/DGMiVeZJ8TE/`: TrainingTall incline running form tutorial mentioning Orange Everest is not an import-quality non-demo and enriches as an exercise demo.
- `https://www.instagram.com/reel/DJ4SrGyJ1wf/`: TrainingTall plank pop regression tutorial mentioning Mayhem is not an import-quality non-demo and enriches as an exercise demo.
- `https://www.instagram.com/reel/DXhB9sniZUG/`: coach.fajardo near-empty `Helpful?` / `Follow for more` caption is an import-quality non-demo and does not enrich as an exercise demo.
- `https://www.instagram.com/reel/Ckg6lS0OnTv/`: Coach Garin class-promo caption is an import-quality non-demo and does not enrich as an exercise demo.
- `https://www.instagram.com/reel/C2YMscHLCJF/`: Coach Garin Transformation Challenge / 1 Mile Benchmark class promo is an import-quality non-demo and does not enrich as an exercise demo.
- `https://www.instagram.com/reel/CndEVB7JFdu/`: Coach Garin Transformation Challenge / Power Hour promo is an import-quality non-demo and does not enrich as an exercise demo.
- `https://www.instagram.com/reel/DXQFZdWjomz/`: coach.fajardo kids business / Muddy Buddies / Italian sodas promo is an import-quality non-demo and does not enrich as an exercise demo.
- `https://www.instagram.com/reel/DUHSQsKiR-t/`: Coach Garin studio gag about climbing over rowers / bouncing over treadmills is an import-quality non-demo and does not enrich as an exercise demo.
- `https://www.instagram.com/reel/C-D2jw9SKc5/`: TrainingTall protein powder / oatmeal sponsor recipe post is an import-quality non-demo and does not enrich as an exercise demo.
- `https://www.instagram.com/reel/DKXb5fDNHas/`: lustertraining basketball/open-gym clip is an import-quality non-demo and does not enrich as an exercise demo.
- `https://www.instagram.com/reel/DLIkRftyJZ1/`: lustertraining basketball pass/shot clip with follow-for-lifting-and-basketball-content CTA is an import-quality non-demo and does not enrich as an exercise demo.
- `https://www.instagram.com/reel/DXedFuSCWAA/`: coach.fajardo opener/closing coach work-life post is an import-quality non-demo and does not enrich as an exercise demo.
- `https://www.instagram.com/reel/DXSWYrDD9n8/`: lustertraining diet/nutrition advice post is an import-quality non-demo and does not enrich as an exercise demo.
- `https://www.instagram.com/reel/CsCmQ0WOJX7/`: brookerooney outdoor wood-chopping/lifestyle clip is an import-quality non-demo and does not enrich as an exercise demo.
- Positive-gate generated-audit rejects are import-quality non-demos and do not enrich as exercise demos: `DI2ERzDzy-Q` TrainingTall OTF/group-fitness endorsement, `DD_GuaQppM_` TrainingTall Christmas/holiday motivation, `C8DI1NwSaHT` TrainingTall salad recipe/nutrition post, `C7PlWfBOeou` TrainingTall/Muscle & Fitness rower battle recap, `DWMQqXVCV97` coach.fajardo goals/sustainability advice, `DVbNvzpCTmX` coach.fajardo coaching philosophy, `DXSexfWEpmd` coach.fajardo kids entrepreneur/school post, `DUdhULCjk2x` coach.fajardo job/social-media-director announcement, `DXSXJB0DzWw` lustertraining nutrition/basketball recruiting advice, `DMTA_fJgdp4` lustertraining basketball shooting form, `DWg1dg9j3ju` lustertraining recruiting/strength advice, and `DK8OFBcSl8c` brookerooney personal tribute caption.
- Representative generated-audit Coach Garin studio/class announcements are import-quality non-demos and do not enrich as exercise demos: `Ct7hrwwNa39` Catch Me If You Can tomorrow, `DAJ-vJ9PTZn` Day 1 tomorrow, `CeMr_rXFtRo` chipping/don't-miss tomorrow, `C0-PiA0LNoi` cookie exchange/templates, `C2Ii2Hov5kr` OTF friends shoe notice, `C_G1G4lSYET` book-into class times, `Ci_IlAlpFsJ` heart-rate/rower technology notice, `C3lZ2hLrMHO` full-workout/cooldown prompt, `CnDnPbcpGwh` 200m Benchmark Row PR recap, `C20XBjPvhEQ` Tread 50 promo, `Cq0vnfAgoiu` studio-week announcement, `DCuororyKPi` Orange Lights promo, `C2yRqQmLyfE` 500m Row tomorrow promo, and `CrHPmn7PGWC` Inferno tomorrow promo.

Ran crafted TrainingTall tutorial verification:

- Running, split squat, TRX row, pushup, and deadlift instructional captions: guard `False`, demo `True`.

Ran syntax verification:

- `python3 -m py_compile scripts/enrich_local.py`

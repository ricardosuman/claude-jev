# jev benchmark

what was measured, how, and where the numbers stop being trustworthy.

## what is being tested

jev is typesafe ai's system one classifier: it answers with a typed choice and a probability instead of generating prose. from this machine a call took 720–736 ms at the median, network included — that is our measurement of the round trip, not the model's own latency. the claim under test: some of the small decisions claude code makes on every turn can be handed to it **without costing correctness**. a component earns a default only if it clears that bar.

the plugin applies a decision only when jev's confidence clears a gate, and fails open: no answer, and claude code carries on as if the plugin were absent.

## verdicts

| component | what it decides | evidence | result | verdict |
|---|---|---|---|---|
| **router** | model and effort, at cache-cold points | r1 171 runs, r2 228 runs | **−24.5% cost per solved task**, 57/57 vs 56/57 | **enable** |
| **offload** | which chunks of a >8,000-char tool output to keep | r4 48 runs, paired | **−18% wall-clock**, cost flat (12–12 paired) | **enable**, for speed |
| **lanes** | offer a subagent when the router holds the model | r2 57 runs | −19% vs no plugin, worse than router alone (−24.5%) | keep off |
| **find** | a `jev-find` tool that ranks paths | r3 + r5, 48 runs | offered 24 times, called 0 | keep off |
| **compact pruning** | prune the transcript before native compaction | needle test | recall 3/4 vs 4/4 | removed |
| **compact** (pause) | when to compact, inside 60–85% fill | r7 162 runs | −4% overall (noise); −16% on hard | keep off |
| **coach** (bench only) | a context brief prefixed to lane spawns | r8 80 runs | cost indistinguishable from baseline; −16% on hard | keep off |
| **read-window** | narrow a large `Read` to the relevant part | r6, 50 cases | 90% recall vs 24% chance | shadow only |
| **tool-describe** | defer unneeded tool groups | none | the bench has no groups to defer | shadow only |
| **drop sonnet** | router with `JEV_MODELS=haiku,opus` | r2 57 runs | −10.7% instead of −24.5% | keep sonnet |

`coach` exists only inside `bench/run.ts`; it is not a component of the plugin.

## rounds

| round | date | arms | cases | runs | cost | summary file |
|---|---|---|---|---:|---:|---|
| r1 | 2026-09-19 | A, C, D | 19 | 171 | $23.89 | `bench/full-2026-09-19-ACD.txt` |
| r2 | 2026-09-21 | A, D, E, F | 19 | 228 | $53.74 | `bench/full-2026-09-21-ADEF.txt` |
| r3 | 2026-09-21 | D, J | 4 wide | 24 | $3.09 | `bench/find-2026-09-21-DJ.txt` |
| r4 | 2026-09-21 | C, D | 3 big-output | 48 | $10.95 | `bench/offload-2026-09-21-CD.txt` |
| r5 | 2026-09-21 | D, J | 4 vocab | 24 | $4.15 | `bench/vocab-2026-09-21-DJ.txt` |
| r6 | 2026-09-21 | read-window, no agent | 50 | — | ~$0.03 | `bench/readwindow/results.jsonl` |
| r7 | 2026-09-21 | D, G, H | 27 | 243 | $53.26 | `bench/round7-2026-09-21-DGH.txt` |
| r8 | 2026-09-21 | G | 27 | 81 | $14.52 | `bench/round8-2026-09-21-G.txt` |

819 agent runs, $163.60. 81 of them (r7 arm G) are invalid — see [incidents](#incidents) — and one r8 run is harness noise, leaving 737.

## arms

| arm | configuration |
|---|---|
| A | no plugin, opus |
| C | router |
| D | router + offload — the baseline from r2 on |
| E | router + offload, `JEV_MODELS=haiku,opus` |
| F | router + offload + lanes |
| G | router + offload + lanes + coach |
| H | router + offload + compact |
| J | router + offload + find |

every arm starts on opus 5 at medium effort. B (plugin loaded, nothing on) and I (G + compact) are defined and were never run.

## router

**what it decides.** at a cache-cold point (first turn, `/clear`, compaction, `/resume`) jev picks a model (haiku, sonnet, opus) and an effort. it never routes above the current model and never raises effort. a *subtle-correctness* question (races, time zones, money, complexity bounds, invariants) and a *risk* question can each veto a downgrade. the decision is held until the next cold point so the prompt cache survives.

**r1 went wrong on hard tasks.** without a veto, hard cases went to sonnet: C passed 6/12 and D 9/12 on hard, against A's 12/12. the subtle veto (threshold 0.6) was added because of that.

**r2 is the result**, after the veto:

| arm | passed | cost per solved | model cost share |
|---|---:|---:|---|
| A — no plugin | 56/57 | $0.2741 | opus 100% |
| D — router + offload | 57/57 | **$0.2070** (−24.5%) | opus 83%, sonnet 15%, haiku 2% |
| E — no sonnet | 57/57 | $0.2447 (−10.7%) | opus 98%, haiku 2% |
| F — + lanes | 57/57 | $0.2219 (−19.0%) | opus 85%, sonnet 13%, haiku 2% |

r2 cost per solved task, by tier:

| tier | A | D | E | F |
|---|---:|---:|---:|---:|
| lookup | $0.0985 | $0.0204 | $0.0222 | $0.0228 |
| local-change | $0.1710 | $0.1232 | $0.1661 | $0.1282 |
| debug | $0.1516 | $0.1038 | $0.1501 | $0.1032 |
| hard | $0.5787 | $0.5734 | $0.5604 | $0.6072 |
| big-output | $0.4187 | $0.2165 | $0.3511 | $0.2565 |

the saving is lookup (to haiku) and debug, local-change and big-output (to sonnet). hard stays on opus in every arm, and every arm passed it 12/12. D includes offload, but r4 shows offload does not move cost, so the −24.5% is the router.

**dropping sonnet (E) loses most of it**: sonnet carried debug, local-change and big-output at 100% pass.

**calibration.** in the commit that added it, the subtle question scored the hard cases 0.89–0.94, cheap cases 0.09–0.22, and `debug-median` 0.51. the threshold began at 0.7 and moved to 0.6 after a real empty next.js project scored subtle 0.67 and would have gone to sonnet.

**two real misses outside the bench**, both made from the first message and then held: that next.js project (before the threshold change), and this repository's own benchmark session, first sent to haiku/low and then grown into orchestration work. the router cannot see scope that was absent from the opening message.

## offload

**what it decides.** a bash, webfetch or mcp result over 8,000 characters is saved whole under `.claude/jev/`; jev picks which middle chunks the task still needs, and the model sees head, tail and those chunks.

**r4 isolated it** — big-output cases only, 8 runs a cell:

| arm | passed | cost per solved | mean turns | mean wall-clock |
|---|---:|---:|---:|---:|
| C — router | 24/24 | $0.2368 | 12.4 | 43.8 s |
| D — router + offload | 24/24 | $0.2195 | 12.4 | 35.9 s |

**−18% wall-clock, same turns, cost a coin flip**: paired by case and run, 12–12. the 7% mean gap is a few expensive C runs; the conventional median moves 2%.

r1 had read offload as 4.5% more expensive and three passes better. those three passes were hard-tier rows where offload never fired — at n=3 an 8% effect is noise.

## lanes

**what it decides.** when the router holds the model, offer a `jev:lane` subagent for self-contained work. never offered after a downgrade.

**r2, arm F**: $0.2219 per solved task against D's $0.2070, worse than D on every tier but debug, where it tied. worst on hard ($0.6072 vs $0.5734): a lane re-reads files and rebuilds context the parent already had.

## find

**what it decides.** `jev-find` scores up to 50 candidate paths; the model may call it.

r3 used 4 `wide-*` cases whose prompts name no file; r5 used 4 `vocab-*` cases in an invented dialect, where every content word of the prompt matches zero files. **offered in all 24 J runs, called in 0.** cost and pass tied with D on wide; vocab pass fell to 7/12 for both arms alike. the model reaches for grep, and a tool it never calls does not exist.

## compact

**pruning (removed).** an early version pruned the transcript before the native summariser ran. needle recall was 3/4 against the native summariser's 4/4, and the step cost more.

**pause-triggered (r7, arm H vs D).** at the end of a turn, inside 60–85% fill and at least 5 turns after the last compaction, jev judges whether the work is at a natural pause.

| tier | D cost/solved | H cost/solved | Δ |
|---|---:|---:|---:|
| lookup | $0.0216 | $0.0225 | +4% |
| debug | $0.0986 | $0.0981 | −1% |
| local-change | $0.0977 | $0.0972 | −1% |
| wide | $0.1425 | $0.1406 | −1% |
| vocab | $0.1637 | $0.1928 | +18% |
| big-output | $0.2093 | $0.2365 | +13% |
| hard | $0.6104 | $0.5117 | **−16%** |
| **all** | $0.1987 (78/81) | $0.1908 (78/81) | −4% |

−4% overall is inside the noise of n=3. the hard-tier gap is the one real-looking signal, and it rests on one round.

## coach (bench only)

**what it decides.** before a `jev:lane` spawn, prefix the lane's prompt with a brief built from the session: up to 10 relevant paths, the last four messages, invariant lines, and a verification command. no jev call; plain heuristics.

**r8, arm G** (valid rerun, see [incidents](#incidents)) against r7's D:

| tier | D (r7) | G (r8) | Δ |
|---|---:|---:|---:|
| lookup | $0.0216 | $0.0237 | +10% |
| debug | $0.0986 | $0.1070 | +9% |
| local-change | $0.0977 | $0.1047 | +7% |
| wide | $0.1425 | $0.1178 | −17% |
| vocab | $0.1637 | $0.1576 | −4% |
| big-output | $0.2093 | $0.2481 | +19% |
| hard | $0.6104 | $0.5136 | **−16%** |
| **all** | $0.1987 (78/81) | $0.1937 (75/80) | −2.5% |

the same shape as compact: a small premium on short work, a sixth off hard work.

**pass is not clearly worse.** G's extra failures are one `big-output-log` run and vocab runs; `vocab-trace` is a broken case (below) that fails for every arm. excluding it: D 77/78, H 77/78, G 74/77 — within noise. turn-limit hits are not specific to G either: D hit `error_max_turns` twice on hard, H once on big-output, G twice on vocab. D averaged *more* turns on vocab (18.7) than G (17.6).

**caveat:** G ran in a separate round, hours later, with its own seed. across rounds a 2.5% difference is not a measurement.

## read-window

**what it decides.** narrow a `Read` of a large file to the fifth that answers the current request.

r6 measured it before building it, on 50 hand-written cases over real source files of 572–1,869 lines, one target line planted in each fifth of the files:

| strategy | recall | median distance |
|---|---:|---:|
| head (first fifth) | 20% | 372 lines |
| random (chance) | 24% | 168 lines |
| **jev** | **90%** | **11.5 lines** |

when it misses, it misses badly: the five misses are 184–644 lines off, the wrong region, not a near miss. widening the window to 40% lifts random to 46% and jev only to 92%.

one read in ten would hand the model the wrong part of a file it asked for. so the hook is **shadow only**: it records the window it would pick and returns the whole file.

## tool-describe

**what it decides.** which web, mcp, notebook and browser tool groups the task needs, deferring the rest behind `ToolSearch`.

**not measured, and this bench cannot measure it**: its cases get five tools and a restricted bash, with no group to defer. it is **shadow only**: it records what it would hide and hides nothing, so real use can price it.

## method

**cases.** 27 command-graded cases in 7 tiers:

| tier | cases |
|---|---|
| lookup | `lookup-port`, `lookup-retry`, `lookup-slugify`, `lookup-tax-rate` |
| local-change | `change-add-clamp`, `change-port-range`, `change-rename-subtotal`, `change-tax-rate` |
| debug | `debug-duration`, `debug-median`, `debug-retry`, `debug-slug` |
| hard | `hard-cache-race`, `hard-dst`, `hard-lru-refactor`, `hard-money` |
| big-output | `big-output-json`, `big-output-log`, `big-output-tests` |
| wide | `wide-change-validator`, `wide-debug-handler`, `wide-lookup-config`, `wide-trace-flow` |
| vocab | `vocab-change`, `vocab-debug`, `vocab-lookup`, `vocab-trace` |

r1 and r2 used the first 19; wide and vocab were added for find and joined the main set in r7.

**runs.** 3 per case per arm (r4: 8), in a seeded shuffle. before each case, one discarded arm-A warm-up fills the prompt cache. each run gets a fresh scaffold in a temp dir.

**tools.** read, edit, write, glob, grep, and bash limited to `bun test`, `bun run`, `ls`, `cat`, `git diff`, `git status`.

**graders.** file, regex and command. hard cases copy a hidden spec in only after the agent finishes, then run `bun test`. a pass means the grader passed, even if the run also hit `error_max_turns`.

**cost.** claude code's `total_cost_usd` — an api-price estimate, not what a subscription is charged. cost per solved task = total cost ÷ passed runs.

**jev overhead.** the ledger records jev tokens and latency, not dollars. at typesafe's published $0.042 per million input tokens, a routing call costs about $0.00003 and takes ~730 ms at the median.

## incidents

**r7 arm G measured nothing.** the bench builds the coach arm its own plugin folder, and listed `./coach.ts` next to `./register.ts` in `hooks.json`. the engine loads one module from that list; with two it loaded none. G ran on bare opus, no jev at all, and came out 46% more expensive — the price of unrouted opus, not of the coach. nothing reported the refusal. it surfaced because G's ledger held zero jev entries while D and H held 80+. fixed in the bench (one module, and a matcher on the duplicate `agent.spawn` hook), which now also runs `claude plugin validate` on every plugin folder before the first case. r8 is the rerun.

**r2 and the five-hour window.** r2 started before the five-hour guard existed. when the window ran out, 18 runs returned only `You've hit your session limit`. they were detected, removed and rerun; the published r2 is the corrected set. the runner now stops at the window and resumes with `--resume`.

**r8 junk run.** `wide-trace-flow.G.2`: zero cost, one turn, error `success`. dropped.

**`vocab-trace` is broken.** its fixture has two entities that both read as "a reservation"; the model traces one, the grader wants the other. it measures ambiguity, and fails for every arm.

## lessons

1. **n=1 on hard lies.** a sonnet check on the four hard cases passed 4/4; six attempts each in r1 passed 15/24.
2. **n=3 cannot separate an 8% effect from noise.** r1 credited offload with passes on rows where it never fired; r4, at n=8, corrected it.
3. **a result needs a chance baseline.** read-window's 90% means something because random scored 24%.
4. **a grader that passes on the untouched fixture measures the fixture.** every case must fail before the agent acts.
5. **a tool the model never reaches for does not exist.** registering, describing and allowing `jev-find` was not enough.
6. **check that the thing under test ran.** a plugin the engine refuses is silent; r7 spent $23 measuring nothing.

## limits

- **opus 5 only.** every arm started on `claude-opus-5`, and `--model opus` now resolves to opus 5.5. the savings, the model mix and the hard-tier veto are unmeasured on it.
- **synthetic cases, one author, one operator.** 27 small tasks written for this bench; no real repositories, long sessions or multi-hour work.
- **n=3.** differences under ~10% are not established. compact and coach rest on one round each.
- **cross-round comparisons.** coach (r8) is compared with D from r7.
- **command graders only.** no judgement of code quality, readability or review cost.
- **no mcp, web, notebook or browser tools**, so tool-describe is untested.
- **read-window's corpus is a snapshot.** its 50 cases point at line numbers in this repository as it stood when round 6 ran, and in `mods/` of [anthropics/claude-code](https://github.com/anthropics/claude-code), cloned next to this one as `claude-code/`. later edits move those lines, so it reproduces only against the snapshots of 2026-09-21.

## reproduction

needs claude code credentials, `TYPESAFE_API_KEY`, and `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`.

```sh
# r1
bun bench/run.ts --arms A,C,D --cases '*' --runs 3 --model opus --effort medium --max-cost-usd 60 --seed 3136862268
# r2
bun bench/run.ts --arms A,D,E,F --cases '*' --runs 3 --model opus --effort medium --max-five-hour 90 --max-cost-usd 60 --seed 3266266169
# r3 find, wide
bun bench/run.ts --arms D,J --cases 'wide-*' --runs 3 --model opus --effort medium --max-cost-usd 15 --seed 3299978120
# r4 offload
bun bench/run.ts --arms C,D --cases 'big-output-*' --runs 8 --model opus --effort medium --max-cost-usd 12 --seed 3301847677
# r5 find, vocab
bun bench/run.ts --arms D,J --cases 'vocab-*' --runs 3 --model opus --effort medium --max-cost-usd 15 --seed 3304049276
# r6 read-window
bun bench/readwindow.ts
# r7 compact (and the invalid coach arm)
bun bench/run.ts --arms D,G,H --cases '*' --runs 3 --model opus --effort medium --max-cost-usd 60 --seed 3306341796
# r8 coach
bun bench/run.ts --arms G --cases '*' --runs 3 --model opus --effort medium --max-cost-usd 35 --seed 3328759335

bun bench/summarize.ts bench/results/<timestamp>/runs.jsonl
```

r1 and r2 ran with 19 cases; `--cases '*'` now selects 27, so rerun them with the 19 names to match. `--model opus` now resolves to opus 5.5, so a rerun measures a different model. `bench/results/` is not committed; the per-round summary files above are.

## appendix: r2 per case

passed/3; cost per solved; median duration.

| case | A | D | E | F |
|---|---|---|---|---|
| lookup-port | 3/3; $0.0884; 3.7 s | 3/3; $0.0212; 7.6 s | 3/3; $0.0214; 8.2 s | 3/3; $0.0292; 9.7 s |
| lookup-retry | 3/3; $0.1036; 6.6 s | 3/3; $0.0200; 8.9 s | 3/3; $0.0195; 8.3 s | 3/3; $0.0207; 8.4 s |
| lookup-slugify | 3/3; $0.1093; 7.9 s | 3/3; $0.0213; 11.7 s | 3/3; $0.0266; 11.5 s | 3/3; $0.0214; 11.6 s |
| lookup-tax-rate | 3/3; $0.0927; 3.9 s | 3/3; $0.0190; 7.3 s | 3/3; $0.0213; 10.3 s | 3/3; $0.0199; 7.4 s |
| change-add-clamp | 3/3; $0.1698; 15.9 s | 3/3; $0.0946; 16.9 s | 3/3; $0.1618; 14.2 s | 3/3; $0.0724; 18.2 s |
| change-port-range | 3/3; $0.1743; 15.4 s | 3/3; $0.1379; 18.9 s | 3/3; $0.1748; 15.9 s | 3/3; $0.1363; 14.5 s |
| change-rename-subtotal | 3/3; $0.1777; 16.9 s | 3/3; $0.1351; 16.1 s | 3/3; $0.1649; 13.7 s | 3/3; $0.1408; 17.4 s |
| change-tax-rate | 3/3; $0.1624; 13.3 s | 3/3; $0.1254; 13.5 s | 3/3; $0.1627; 13.6 s | 3/3; $0.1632; 15.9 s |
| debug-duration | 3/3; $0.1456; 11.0 s | 3/3; $0.1456; 11.2 s | 3/3; $0.1467; 11.9 s | 3/3; $0.1442; 11.1 s |
| debug-median | 3/3; $0.1496; 12.6 s | 3/3; $0.0636; 11.2 s | 3/3; $0.1500; 12.9 s | 3/3; $0.0614; 10.0 s |
| debug-retry | 3/3; $0.1546; 11.7 s | 3/3; $0.1446; 12.1 s | 3/3; $0.1459; 12.6 s | 3/3; $0.1461; 11.8 s |
| debug-slug | 3/3; $0.1566; 12.8 s | 3/3; $0.0614; 9.7 s | 3/3; $0.1580; 23.2 s | 3/3; $0.0612; 11.1 s |
| hard-cache-race | 3/3; $0.3168; 43.1 s | 3/3; $0.3962; 57.9 s | 3/3; $0.3417; 56.3 s | 3/3; $0.4879; 67.4 s |
| hard-dst | 3/3; $0.4345; 66.2 s | 3/3; $0.3515; 57.3 s | 3/3; $0.4180; 74.0 s | 3/3; $0.3340; 50.7 s |
| hard-lru-refactor | 3/3; $1.2298; 253.7 s | 3/3; $1.2468; 313.3 s | 3/3; $1.1635; 331.2 s | 3/3; $1.2879; 288.9 s |
| hard-money | 3/3; $0.3339; 55.5 s | 3/3; $0.2992; 55.3 s | 3/3; $0.3185; 53.2 s | 3/3; $0.3192; 59.5 s |
| big-output-json | 3/3; $0.3938; 47.4 s | 3/3; $0.3525; 46.9 s | 3/3; $0.3363; 41.0 s | 3/3; $0.3212; 38.3 s |
| big-output-log | 2/3; $0.6057; 59.2 s | 3/3; $0.1615; 38.6 s | 3/3; $0.4421; 62.7 s | 3/3; $0.2507; 32.8 s |
| big-output-tests | 3/3; $0.3189; 28.4 s | 3/3; $0.1357; 20.5 s | 3/3; $0.2749; 26.6 s | 3/3; $0.1974; 33.9 s |

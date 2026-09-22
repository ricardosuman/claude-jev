# claude-jev

**use jev to cut claude code costs.** jev is typesafe ai's system one classifier: instead of generating text, it answers with a typed choice and a probability. this plugin hands it some of the small decisions claude code makes on every turn — which model to run, which part of a large output to keep — and measures whether that costs correctness.

after 8 rounds (737 valid agent runs), two components earn a default: **router** (−24.5% cost per solved task) and **offload** (−18% wall-clock). a jev call took ~700 ms at the median in our runs, network included, and costs a fraction of a cent. the plugin is fail-open: if jev does not answer, claude code carries on unchanged.

## results

| component | what it does | result | verdict |
|---|---|---|---|
| **router** | picks haiku, sonnet or opus and the effort, at cache-cold points | **−24.5% cost per solved task**, 57/57 vs 56/57 (228 runs) | **enable** |
| **offload** | keeps only the relevant chunks of a large bash/mcp output | **−18% wall-clock**, cost flat (48 runs, paired) | **enable** |
| **compact** | asks jev when to compact, inside 60–85% fill | −4% overall, within noise; −16% on hard tasks | keep off |
| **lanes** | offers a subagent when the router keeps the model | worse than router alone on every tier but debug | keep off |
| **find** | a `jev-find` tool that ranks paths | offered 24 times, called 0 | keep off |
| **read-window** | narrows a large `Read` to the relevant part | 90% recall vs 24% for a random window | shadow only |
| **tool-describe** | defers tool groups the task does not need | not measured: the bench has no groups to defer | shadow only |

shadow only means it records what it would do and changes nothing, so real use can measure it.

also tested and rejected: pruning the transcript before compaction (lost context), a router without sonnet (−10.7% instead of −24.5%), and a context brief for delegated subagents (cost indistinguishable).

## cost per tier

cost per solved task, round 7 (compact) and round 8 (lanes with a context brief), against the baseline `router,offload`:

| tier | baseline | + compact | + lanes & brief |
|---|---:|---:|---:|
| lookup | $0.0216 | $0.0225 (+4%) | $0.0237 (+10%) |
| debug | $0.0986 | $0.0981 (−1%) | $0.1070 (+9%) |
| local-change | $0.0977 | $0.0972 (−1%) | $0.1047 (+7%) |
| wide | $0.1425 | $0.1406 (−1%) | $0.1178 (−17%) |
| vocab | $0.1637 | $0.1928 (+18%) | $0.1576 (−4%) |
| big-output | $0.2093 | $0.2365 (+13%) | $0.2481 (+19%) |
| **hard** | $0.6104 | $0.5117 (**−16%**) | $0.5136 (**−16%**) |

both extras pay only on hard tasks and cost a little everywhere else, so neither is a default. 3 runs per cell: treat any gap under ~10% as noise.

## install

function hooks are early access in claude code, so this plugin runs only where `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1` is available.

1. clone it:

   ```sh
   git clone https://github.com/ricardosuman/claude-jev.git ~/claude-jev
   ```

2. get an api key from typesafe's jev dashboard and export it (in `~/.zshrc` or `~/.bashrc`):

   ```sh
   export TYPESAFE_API_KEY=...
   ```

3. add the alias to the same file, pointing at where you cloned it:

   ```sh
   alias cjev='CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 JEV_COMPONENTS=router,offload claude --plugin-dir ~/claude-jev'
   ```

4. reload the shell (`source ~/.zshrc`).

## use

open claude code with `cjev` instead of `claude`, in any project:

```sh
cd ~/my-project
cjev
```

every `claude` flag still works: `cjev -c` continues the last session, `cjev -p "..."` runs headless. plain `claude` opens without jev.

from there, nothing to do: jev decides at cache-cold points (first turn, `/clear`, compaction, `/resume`) and holds the decision until the next one, so the prompt cache survives. each decision shows as a `jev:` line in the transcript.

inside a session:

- `/jev` — toggles a live pane with the ledger
- `/jev text` — prints the ledger's summary
- `/jev json` — prints the raw rows
- `/jev gains` — usage across sessions, from `~/.claude/jev/usage.jsonl`: how often the router applied or held, which models it chose, how much offload trimmed, what the shadow components would have done

## configure

- `JEV_COMPONENTS` — comma-separated: `router`, `offload`, `lanes`, `find`, `compact`, `tool-describe`, `shadow`. `none` loads the plugin and applies nothing. `shadow` is global: every enabled component records instead of applying.
- `JEV_MODELS` — models the router may choose (default `haiku,sonnet,opus`).
- without these variables, the same switches are the `"on"`/`"off"` options in `userConfig` (`.claude-plugin/plugin.json`), along with thresholds and timeouts.

## limits

measured on opus 5 with 27 small synthetic cases, 3 runs each. the router now routes to opus 5.5 where it picks opus, but nothing was measured on 5.5. details in the benchmark report.

## run the benchmark

```sh
bun bench/run.ts --arms D --cases 'debug-*' --runs 3 --model opus --effort medium --max-cost-usd 5
bun bench/summarize.ts bench/results/<timestamp>/runs.jsonl
```

a smoke run like this costs about $5; a full round of 27 cases × 3 runs × 3 arms cost $53.

## more

method, every round, incidents and limits: [`docs/BENCHMARK.md`](docs/BENCHMARK.md). license: mit.

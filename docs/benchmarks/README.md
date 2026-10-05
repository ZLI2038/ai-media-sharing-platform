# Local verification and benchmark evidence

## Historical run: 2026-09-08

The [archived reports](2026-09-08/) were produced from source commit `180b319a81af5543adc0cdac267e62cfd107f0a7` in the original local project. That identifier records provenance; it is not a commit expected in this publication repository. The original run verified hashes of 86 tracked files.

This publication removes deployment-specific metadata and browser form-value logging, updates documentation/package naming, and makes the harness portable. Archived metrics remain attributed to the earlier snapshot. Personal filesystem paths are replaced with `<isolated-build>`; numeric samples are unchanged.

Environment: Apple M2 Pro, 12 logical CPUs, 16 GiB RAM; macOS arm64; Node 24.19.0; Miniflare 4.20260515.0; workerd compatibility date 2026-05-15. The harness loads the production server bundle and real route dispatcher. D1 and R2 use ephemeral local emulation; OpenAI responses are stubbed. No cloud or paid-provider performance is measured.

## Index experiment

The dataset has 100,000 synthetic posts across 1,000 authors. Both queries select the same columns for an author, order by descending creation time, and return at most 100 rows. The control adds SQLite `NOT INDEXED`. This is a controlled index comparison, not a measured before/after application release.

Each variant receives 20 warmups followed by 500 paired measurements in alternating AB/BA order. Every pair must return identical records. Timing includes the local Node/workerd bridge and D1 query, but excludes HTTP route/authentication/schema overhead. P95 uses nearest rank.

| Measurement | Indexed | Unindexed control |
| --- | ---: | ---: |
| P50 (ms) | 4.702583 | 13.142500 |
| P95 (ms) | 6.980750 | 16.487709 |
| P99 (ms) | 11.320166 | 19.958583 |
| D1 rows read | 100 | 100100 |

P95 reduction: `100 × (1 − 6.980750 / 16.487709) = 57.66%`. Rows-read reduction: 99.9001%. See [500 paired samples](2026-09-08/index-samples.json) and query plans in [results.json](2026-09-08/results.json).

Separate full-route tests use 20 warmups and 200 requests at concurrency 1 per scenario. P95 is 5.10 ms for author filtering, 8.06 ms for a two-keyword hit, and 55.17 ms for no-match keyword search. These use a different measurement path from the query bridge; they cannot be interpreted as stacked timing components. The results do not imply all searches finish under 10 ms.

## Functional checks

- [Main results](2026-09-08/results.json): 50 grouped checks covering legacy REST contracts, authentication, ownership, upload boundaries, fault injection, search, AI proxy behavior, and client-bundle sentinel scanning.
- [Valid-media results](2026-09-08/valid-media-results.json): six additional cases using independently decoded PNG/MP4 fixtures, padded to exact sizes with legal PNG ancillary chunks or MP4 `free` boxes. Accepted media is downloaded and SHA-256 compared.
- [Verified claim summary](2026-09-08/verified-claims.json): machine-readable supporting values.
- The 27 negative access-control requests comprise wrong-password and unknown-user sign-ins, six invalid-token classes across four protected operations, and one cross-account deletion. Positive controls also pass.
- A D1 `BEFORE INSERT` trigger injects 50 failures; each is followed by metadata and R2 checks. This covers that failure path, not every storage failure mode.
- Eight AI cases cover success, upstream 401/429/500, missing image data, empty prompt, invalid JSON, and an absent key. No live-provider latency is claimed.
- Bundle scanning searches for known fake secret sentinels. Zero matches is not a general security audit.

## Reproduce

After `pnpm install --frozen-lockfile`, run from the repository root:

```bash
pnpm test:bench
```

This recreates `.bench/app`, excludes environment files and runtime data, reuses installed dependencies, and injects fixed **fake** credentials solely for testing. It writes a source SHA-256 manifest, build log, fresh results, and timing samples under ignored `.bench/`. It does not overwrite this archive.

For valid PNG/MP4 tests, install Python 3 with Pillow and ffmpeg with libx264:

```bash
pnpm test:media
```

Run the main suite first; the media suite reuses its build. Fixtures consume approximately 150 MiB. Neither suite modifies cloud resources. Latency varies with machine, load, and runtime; functional assertions do not depend on beating the historical numbers.

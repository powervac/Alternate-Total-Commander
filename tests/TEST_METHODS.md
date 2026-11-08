# Test methods and mutation testing

Everything here runs with plain Node 18 (`node:test`), no framework. Two commands:

```
npm test                       all tests (about 300, 10 seconds)
npm run mutate                 mutation testing of every target in tests/mutation.config.json (about 1500 mutants, 20-30 minutes)
npm run mutate -- davclient    only the targets whose file name contains "davclient"
npm run mutate -- --list       count the mutants and run nothing
npm run mutate -- --sample 40 --seed 7 --workers 6     a random sample of 40 mutants per file, 6 parallel workers
```

## 1. What is tested and how

Scope of this first round: the features added in the session that introduced the tests: **WebDAV** (`src/main/davclient.js`),
**FTP / FTPS** (`src/main/ftpclient.js`), the **WinSCP import parser** (`src/main/winscp.js`), the **chip music engine**
(`src/main/ay/ay.js`, the PSG format `src/main/ay/fmt_psg.js`, TurboSound) and the **WAV writer** (`src/main/aywav.js`).
The older features of the program (panels, archives, search, sync, the Synology / SSH / cloud clients, the editor ...) are not covered yet;
`tools/mutate.js` and the helpers are written so that they can be added the same way (one line in `tests/mutation.config.json`).

### Principles (all groups)

1. **Black box through the public interface.** A test calls what the program calls (`connect`, `list`, `upload` ...) and never reads
   private state, except in a few marked white-box tests (the keep-alive counter, the queue length, `chip.evol`).
2. **Real or faithful servers.** FTP runs against a real FTP server (`ftp-srv`, with TLS, fake links, a command log). WebDAV runs against
   `tests/helpers/davserver.js`, a small in-memory server written for the tests, because it can be bent in every way a real one does:
   Basic / Digest login, redirects, other XML dialects, failing methods, cut connections, slow answers.
3. **Every expectation is checked twice:** in the result the client returns *and* in what the server really saw (the request log of the
   WebDAV server, the command log and the files of the FTP server). A client that "works" by doing the wrong thing on the wire fails.
4. **Equivalence classes and boundaries.** Each input is tested with a normal value, the empty value, the first value outside
   (65536 as a port, a range one byte behind the end of a file, a date exactly one day in the future) and a damaged value.
5. **Error injection.** Every status code and failure the client has a message for is produced by the server and the exact message is
   asserted: wrong password, refused port, silent server, untrusted certificate, TLS on a plain port, 4xx / 5xx answers, a connection cut in
   the middle of a transfer, a transfer cancelled by the user.
6. **Reference models for numeric code.** The chip emulator is checked against independent models written from the data sheet (the 16 shapes of
   the envelope, the 17-bit noise shift register, the volume table, the pan), and by measurement (tone frequency by counting edges).
7. **No third-party content in the repository.** No music files, no real servers, no real credentials. Test data is generated.

### Groups, test ids and what they protect

| Feature | File | Ids | Method | Typical defects it catches |
|---|---|---|---|---|
| WebDAV connect | `dav.test.js` | DAV-C1..C8, DAV-S1..S2 | address parsing, PROPFIND probe, every status of the probe, timeout, refused port, DNS failure, self-signed HTTPS | wrong address accepted, wrong message, hang |
| WebDAV login | | DAV-A1..A7 | Basic sent at once, Digest with and without qop, nonce counter, wrong password does not loop, upload after an expired nonce, logout | endless 401 loop, Digest with a bad counter, login kept after logout |
| WebDAV list | | DAV-L1..L9 | 4 XML dialects x 2 href styles, special characters in names, 404-only properties, odd values, 600 entries, `exists` | a name with `#` / `%` / `?`, a folder listing itself, wrong sizes |
| WebDAV change | | DAV-M*, R*, D* | MKCOL (parents first, existing is fine), MOVE with an absolute encoded Destination, recursive DELETE, every error text | files in the wrong folder, overwriting on rename |
| WebDAV transfer | | DAV-G*, U*, P* | byte-exact download / upload, progress, cancel, cut connection, `Range` (206 / 200 / suffix / error), headers a player needs | half files left behind, wrong `Content-Range` |
| WebDAV redirects | | DAV-X1..X5 | 301 / 302 / 307 / 308, loops, uploads, a redirect to **another host must not receive the login** | credential leak, endless redirect |
| FTP connect | `ftp.test.js` | FTP-C1..C12 | USER / PASS on the wire, anonymous, empty password, refused, silent server, DNS, start folder, commands after login, refused command | wrong login sequence, leaked connection |
| FTP over TLS | | FTP-S1..S6 | explicit and implicit TLS, untrusted certificate with and without the box, TLS on a plain port and the other way round, data channel | passwords before AUTH TLS, wrong advice |
| FTP list | | FTP-L1..L7, FTP-T1..T4 | sizes, dates (Unix and DOS `LIST` formats, year rollover), links to folders and files, unusual names, 300 entries | no dates at all, a link shown as a file |
| FTP change | | FTP-M*, R*, D* | nested mkdir and the working folder after it, rename, recursive delete, several paths | wrong folder after `mkdir` |
| FTP transfer | | FTP-G*, U*, P* | byte-exact, progress, cancel and reconnect, overwrite rule, `MFMT`, ranges 206 / 416, empty file, own connection for the player and its cleanup | leaked connections, bad ranges |
| FTP session | | FTP-Q*, X*, K* | queue order of overlapping operations, parallel load on one connection, failure does not poison the queue, reconnect after a drop, keep-alive limits | an upload interleaved with a rename, silent reconnect |
| WinSCP import | `winscp.test.js` | WSC-P*, F*, N*, R* | every protocol number, every field with default and damaged values, names and folders, BOM / line endings, registry output (faked), fallback files | NaN port, `Default Settings` imported |
| Chip emulator | `ay.test.js` | AY-T*, N*, E*, X* | tone frequency of 3 channels x 6 periods, mixer, pan, 16 volumes, noise shift register, 16 envelope shapes, YM effects | wrong pitch, stuck envelope |
| Rendering | | AY-M1..M13 | frame length, speed, pitch, clock precedence, loops, `maxSeconds`, TurboSound mix, progress, beeper | wrong duration, endless render |
| PSG / TurboSound | | AY-F*, AY-S* | the format byte by byte, markers, cut data, the `02TS` container | a crash on a damaged file |
| WAV writer | `aywav.test.js` | WAV-H*, S* | every header field, sample conversion, clipping, channel order, empty input | a file players refuse |

## 2. Mutation testing

A test suite can be green and still be weak: "all tests pass" says nothing about what they would notice. Mutation testing measures that.
`tools/mutate.js` cuts a source file into tokens (acorn) and makes **mutants**: copies of the file with exactly one small change. The
tests of the file run against every mutant. A mutant that makes a test fail (or hang) is **killed**; one that passes everything
**survived**, which means "the program could be broken in this way and no test would say so".

### Mutation operators

| Operator | Change | Question it asks |
|---|---|---|
| arith | `+` `-` `*` `/` `%` swapped | is the arithmetic checked with real numbers? |
| incdec | `++` <-> `--` | loops and counters |
| relational | `<` -> `<=` / `>=`, `>` -> `>=` / `<=` and so on | is every boundary tested (off by one)? |
| equality | `===` <-> `!==`, `==` <-> `!=` | both branches of a comparison |
| logical | `&&` <-> `||` | every part of a condition matters |
| not | the unary `!` is removed | inverted conditions |
| boolean | `true` <-> `false` | flags and defaults |
| number | a literal `n` -> `n + 1` (and `1` -> `0`) | constants: sizes, ports, offsets, header fields |
| string | a string compared with `===` is replaced | protocol words, markers |
| message | the text of `new Error('...')` is replaced | is every error message really asserted? |
| await | `await` is removed | ordering of asynchronous steps |
| if-true / if-false | the condition of an `if` is replaced by `true` / `false` | is every branch reached and checked? |
| return | the returned value is replaced by `undefined` | is every result used and checked? |

Mutants that are not valid JavaScript, and identical ones, are dropped. Each mutant runs in a private copy of `src/main` and `tests`
(`node_modules` is a junction), so mutants run in parallel and the working tree is never touched. The baseline (the unchanged file) must
pass twice before a file is mutated; a mutant is killed when the run fails, hangs (timeout is 5 x the baseline, at least 15 s) or crashes.

### Reading the result

* **Score** = killed / (killed + survived). Target: 90 % or more per file, and every survivor explained.
* A **survivor** is first a question to the tests: write the test that would notice it. If no test can notice it because the program
  behaves the same, it is an **equivalent mutant**: it goes into `tests/mutation-equivalent.json` with the reason (file, line, operator,
  replacement, why), it is shown as "equiv" and not counted in the score. Typical reasons: a defensive default that is never reached, a
  number that only sizes a buffer, the second of two redundant checks, a value that the platform or the other side normalises anyway.
* The report of the last full run is `tests/mutation-report.json` (survivors and equivalents with their line numbers).

# Baduk Live Analysis

Real-time Baduk/Go overlay modules for OGS games and reviews.

## Use

```txt
/game/<OGS_GAME_ID>
/review/<OGS_REVIEW_ID>
```

Examples:

```txt
https://stream-ai.baduk.club/game/77081213
https://stream-ai.baduk.club/review/123456
```

## Modules

Use URL params to show only the pieces you want. Names are case-insensitive.

```txt
?element=board
?elements=player,clock,pie,index,board
```

| Module      | Shows                     |
| ----------- | ------------------------- |
| `board`     | Go board                  |
| `player`    | Player name + turn stone  |
| `clock`     | Player clock              |
| `pie`       | Winrate pie               |
| `legend`    | Move-quality color legend |
| `index`     | Move-quality counters     |
| `shape`     | Shape/pattern name        |
| `area`      | Area/counting chart       |
| `territory` | Territory chart           |
| `eval`      | Winrate/evaluation bar    |
| `status`    | Game status text          |

## Side-specific iframe modules

Use `black=` and/or `white=` for compact, transparent modules intended for
iframes/overlays.

```txt
?black=player
?white=player
?black=clock
?white=index
?black=player,index,clock
?white=player,index,clock
```

Player modules include the turn indicator on the correct side:

```txt
?black=player  ->  Black Player [black stone]
?white=player  ->  [white stone] White Player
```

You can combine global and side modules:

```txt
?elements=board,eval&black=player,clock&white=player,clock
```

## Review clock params

Review URLs can provide clock settings:

```txt
/review/123456?t=1&tc=fis&mt=60m&in=10s
/review/123456?t=1&tc=byo&mt=40m&pd=30sx5
/review/123456?t=1&tc=can&mt=10m&pd=10mx15
```

- `t=1` enables review timer display
- `tc=fis|byo|can`
- `mt=60m`, `30s`, `1h`
- Fischer needs `in=<time>`
- Byo-yomi/Canadian need `pd=<time>x<count>`

## Other params

```txt
?width=300    # scale visible output to 300px wide
?width=300px
?c=black      # shape text color mode
?c=white
?c=quality
?t=1          # move shape display near top / review clock mode
```

## Setup / operations

Install, VM, nginx, HTTPS, and update instructions live in:

- [`docs/INSTALL_AND_MANAGING.md`](docs/INSTALL_AND_MANAGING.md)
- [`VM_HTTPS_NGINX_SETUP.md`](VM_HTTPS_NGINX_SETUP.md)

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

## Overlay params

Use compact URL params to show only the pieces you want. Param layouts are
left-aligned for overlay/iframe use.

### Board

```txt
?board
```

### Territory bar

```txt
?t=bp,bi,wp,wi,bar
```

| Token | Shows           |
| ----- | --------------- |
| `bp`  | Black points    |
| `bi`  | Black influence |
| `wp`  | White points    |
| `wi`  | White influence |
| `bar` | Territory bar   |

### Area bar

```txt
?a=b,w,u,bar
```

| Token | Shows            |
| ----- | ---------------- |
| `b`   | Black points     |
| `w`   | White points     |
| `u`   | Unclaimed points |
| `bar` | Area bar         |

### Winrate/eval bar

```txt
?e=b,w,bar
```

| Token | Shows         |
| ----- | ------------- |
| `b`   | Black percent |
| `w`   | White percent |
| `bar` | Eval bar      |

### Player info

```txt
?p=b,bc,bn,bi,w,wc,wn,wi
```

| Token | Shows                                |
| ----- | ------------------------------------ |
| `b`   | All black info                       |
| `bc`  | Black clock                          |
| `bn`  | Black name + turn indicator stone    |
| `bi`  | Black move-quality index             |
| `w`   | All white info                       |
| `wc`  | White clock                          |
| `wn`  | White name + turn indicator stone    |
| `wi`  | White move-quality index             |

### Other modules

```txt
?effect      # blue move ring effect
?effects     # same as ?effect
?pill        # shape text pill
?pills       # same as ?pill
?pill=p      # points pill instead of shape text
?pie         # winrate pie
?l           # color legend
?r           # result; appears centered on board when ?board is visible
?db          # client/server debug logging
?width=300   # scale visible output to 300px wide
?width=300px
```

## Review clock params

Review URLs can provide clock settings with the `rc` prefix:

```txt
/review/123456?rc&rctc=fis&rcmt=60m&rcin=10s
/review/123456?rc&rctc=byo&rcmt=40m&rcpd=30sx5
/review/123456?rc&rctc=can&rcmt=10m&rcpd=10mx15
```

- `rc` enables review clock handling
- `rctc=fis|byo|can` or `rct=fis|byo|can`
- `rcmt=60m`, `30s`, `1h`
- Fischer needs `rcin=<time>`
- Byo-yomi/Canadian need `rcpd=<time>x<count>`

## Legacy module params

The older `element=`, `elements=`, `black=`, and `white=` forms still work for
backward compatibility, but new overlays should use the compact params above.

## Setup / operations

VM HTTPS/nginx setup:

- [`VM_HTTPS_NGINX_SETUP.md`](VM_HTTPS_NGINX_SETUP.md)

VM update helper:

```sh
./scripts/update-vm.sh
```

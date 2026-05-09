# Canonical workspace (single copy)

All BPVP work must happen in **one** checkout. Duplicate folders cause “old site”, wrong commits, and tunnel pointing at the wrong process.

## Canonical path (use only this)

```text
/Users/joubertlopez/Developer/AXE/bpvp-suite
```

Every command below assumes this directory:

```bash
cd /Users/joubertlopez/Developer/AXE/bpvp-suite
```

## Paths that must NOT be treated as a second project

- `~/Documents/AXE/bpvp-suite` — **do not** develop here unless it is **only** a symlink to the canonical path (see below).

## Freeze the wrong copy (one-time)

If a **real second clone** exists under Documents (not a symlink), rename it so nothing opens it by mistake:

```bash
mv /Users/joubertlopez/Documents/AXE/bpvp-suite \
   /Users/joubertlopez/Documents/AXE/bpvp-suite_ARCHIVED_DO_NOT_USE
```

Optional shortcut that points to the canonical tree (safe):

```bash
mkdir -p /Users/joubertlopez/Documents/AXE
ln -sf /Users/joubertlopez/Developer/AXE/bpvp-suite /Users/joubertlopez/Documents/AXE/bpvp-suite
```

After this, `cd ~/Documents/AXE/bpvp-suite` and `cd ~/Developer/AXE/bpvp-suite` resolve to the **same** files.

## Cursor / IDE

Open the folder **`/Users/joubertlopez/Developer/AXE/bpvp-suite`** as the workspace root. Do not add the archived path.

## Quick verification

```bash
cd /Users/joubertlopez/Developer/AXE/bpvp-suite
pwd
git rev-parse --show-toplevel
git log -1 --oneline
```

`git rev-parse --show-toplevel` must print exactly the canonical path above (after resolving symlinks).

---

## Dejar testnet en línea (un solo comando)

Trabaja siempre aquí:

```bash
cd /Users/joubertlopez/Developer/AXE/bpvp-suite
```

**Una sola vez**, guarda el token del túnel (no se sube a Git; `.run/` está ignorado):

```bash
printf '%s\n' 'PEGAR_TOKEN_DE_CLOUDFLARE_AQUI' > /Users/joubertlopez/Developer/AXE/bpvp-suite/.run/cf-tunnel.token
chmod 600 /Users/joubertlopez/Developer/AXE/bpvp-suite/.run/cf-tunnel.token
```

Cada vez que quieras **sitio local + dominio público**:

```bash
cd /Users/joubertlopez/Developer/AXE/bpvp-suite
git pull origin main
./scripts/online-testnet.sh
```

Eso levanta motor + dashboard y arranca el contenedor `bpvp-cloudflared-domain`.

**Importante:** `./scripts/stop-suite.sh` también borra el túnel. Si lo usas, después vuelve a ejecutar `./scripts/online-testnet.sh` para que `testnet.btc-defi.com` vuelva a funcionar.

#!/bin/sh
# kfdc installer — fetch a published bundle from the homelab package store,
# verify it, unpack it, and point the service at it.
#
# There is deliberately no "install from this checkout" mode. Building in
# place and restarting is exactly the habit k-homelab docs/deploying.md
# exists to end, and kfdc was one of the last services still doing it. The
# thing you verified is the thing the host runs because it is the same
# bytes, fetched, not the same commit, rebuilt.
#
# Usage:
#   install.sh --from-store [--store URL] [--version VER]
#              [--no-restart] [--keep N] [--dry-run]
#
#   --store URL   package store base, or $KFDC_STORE_URL. No default, on
#                 purpose: a guessed hostname fails later as a confusing
#                 curl error instead of here as a sentence.
#   --version VER a published version; omit to resolve `latest`. This is
#                 also the rollback: name the version you want back.
#   --no-restart  install and repoint, but leave the running service alone.
#   --keep N      unpacked versions to retain (default 3). The store is the
#                 real history; this is just a fast local rollback.
#
# Bootstrapping a host with no checkout — note that install.sh itself is
# checksum-verified before it runs, which `curl | sh` cannot offer:
#
#   base="$KFDC_STORE_URL/artifacts/kfdc"
#   v=$(curl -fsS "$base/latest")
#   curl -fsS -O "$base/$v/install.sh"
#   curl -fsS "$base/$v/SHA256SUMS" | grep ' install.sh$' | sha256sum -c -
#   sh install.sh --from-store --version "$v"

set -eu

NAME=kfdc
FROM_STORE=0
STORE_URL="${KFDC_STORE_URL:-}"
STORE_VERSION=""
RESTART=1
KEEP=3
DRY_RUN=0

SHARE_DIR="$HOME/.local/share/$NAME"
VERSIONS_DIR="$SHARE_DIR/versions"
CURRENT="$SHARE_DIR/current"
CONF_DIR="$HOME/.config/$NAME"
CONF="$CONF_DIR/$NAME.env"
UNIT_DIR="$HOME/.config/systemd/user"
UNIT="$UNIT_DIR/$NAME.service"

fail() { printf '%s: %s\n' "$0" "$1" >&2; exit 1; }
note() { printf '  %s\n' "$1"; }
run() {
    if [ "$DRY_RUN" -eq 1 ]; then printf '  would: %s\n' "$*"; else eval "$@"; fi
}

while [ $# -gt 0 ]; do
    case "$1" in
        --from-store) FROM_STORE=1 ;;
        --store)
            shift; [ $# -gt 0 ] || fail "--store needs a URL"
            STORE_URL="$1" ;;
        --version)
            shift; [ $# -gt 0 ] || fail "--version needs a value"
            STORE_VERSION="$1" ;;
        --no-restart) RESTART=0 ;;
        --keep)
            shift; [ $# -gt 0 ] || fail "--keep needs a count"
            KEEP="$1" ;;
        --dry-run) DRY_RUN=1 ;;
        -h|--help)
            sed -n '2,31p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) fail "unknown argument: $1 (try --help)" ;;
    esac
    shift
done

[ "$FROM_STORE" -eq 1 ] || fail \
    "--from-store is the only install mode; kfdc no longer deploys from a checkout"

case "$KEEP" in
    ''|*[!0-9]*) fail "--keep wants a number, got '$KEEP'" ;;
esac
[ "$KEEP" -ge 1 ] || fail "--keep must be at least 1 (the running version)"

for cmd in curl sha256sum tar systemctl; do
    command -v "$cmd" >/dev/null 2>&1 || fail "$cmd not found on this host; the installer needs it"
done

[ -n "$STORE_URL" ] || fail \
    "no package store URL — pass --store URL or set KFDC_STORE_URL (e.g. https://<host>:4880)"
STORE_URL=${STORE_URL%/}
STORE_BASE="$STORE_URL/artifacts/$NAME"

# --- 1. Resolve the version -----------------------------------------------

if [ -z "$STORE_VERSION" ]; then
    latest=$(curl -fsS "$STORE_BASE/latest") \
        || fail "cannot read $STORE_BASE/latest — is the store reachable from here?"
    STORE_VERSION=$(printf '%s' "$latest" | tr -d '[:space:]')
    [ -n "$STORE_VERSION" ] || fail "the latest pointer at $STORE_BASE/latest is empty"
    note "resolved latest = $STORE_VERSION"
fi

VERSION_URL="$STORE_BASE/$STORE_VERSION"
TARBALL="$NAME-$STORE_VERSION.tar.gz"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM

printf 'fetching %s %s from %s\n' "$NAME" "$STORE_VERSION" "$STORE_URL"

# --- 2. Fetch and verify everything before installing anything -------------

SUMS=$(curl -fsS "$VERSION_URL/SHA256SUMS") \
    || fail "cannot read $VERSION_URL/SHA256SUMS — is $STORE_VERSION published?"

for f in "$TARBALL" "$NAME.service" "$NAME.env.example"; do
    curl -fsS -o "$WORK/$f" "$VERSION_URL/$f" \
        || fail "fetch failed: $VERSION_URL/$f — is $STORE_VERSION published with a full bundle?"
    line=$(printf '%s\n' "$SUMS" | grep -E "[[:space:]][*]?$(printf '%s' "$f" | sed 's/[.[\*^$]/\\&/g')\$" | head -1)
    [ -n "$line" ] || fail "$f is not listed in $VERSION_URL/SHA256SUMS"
    ( cd "$WORK" && printf '%s\n' "$line" | sha256sum -c --status - ) \
        || fail "checksum MISMATCH for $f — refusing to install"
    note "$f  checksum OK"
done

mkdir -p "$WORK/unpack"
tar -xzf "$WORK/$TARBALL" -C "$WORK/unpack" \
    || fail "$TARBALL will not unpack — the published artifact is damaged"

[ -f "$WORK/unpack/build/index.js" ] \
    || fail "$TARBALL holds no build/index.js — that is not a kfdc bundle"

# The checksum proves the transfer; this proves the *label*. A bundle
# published under the wrong version installs cleanly and then lies about
# what this host is running. `just publish` writes VERSION from the same
# string it publishes under, so this comparison is exact.
[ -f "$WORK/unpack/VERSION" ] || fail "$TARBALL carries no VERSION stamp"
stamped=$(tr -d '[:space:]' < "$WORK/unpack/VERSION")
[ "$stamped" = "$STORE_VERSION" ] || fail \
    "the fetched bundle is stamped $stamped but published as $STORE_VERSION — the store's labelling is wrong, not this host"
note "stamped $stamped"

# --- 3. Configuration (host state, never shipped) -------------------------

if [ ! -f "$CONF" ]; then
    if [ "$DRY_RUN" -eq 1 ]; then
        note "would seed $CONF from the bundled template and stop"
    else
        mkdir -p "$CONF_DIR"
        cp "$WORK/$NAME.env.example" "$CONF"
        chmod 0600 "$CONF"
        fail "no config at $CONF — seeded it from the bundle's template.
       Fill in KORG_URL, PORT and ORIGIN for this host, then re-run."
    fi
fi

conf_value() {
    sed -n "s/^[[:space:]]*$1=//p" "$CONF" | tail -1 | tr -d "\"' "
}
PORT=$(conf_value PORT)
ORIGIN=$(conf_value ORIGIN)
[ -n "$PORT" ] || fail "$CONF sets no PORT — the adapter would silently serve :3000"
[ -n "$ORIGIN" ] || fail "$CONF sets no ORIGIN — form posts and redirects would point at the wrong host"
note "config $CONF  PORT=$PORT  ORIGIN=$ORIGIN"

# --- 4. Install the version -----------------------------------------------

TARGET="$VERSIONS_DIR/$STORE_VERSION"
printf 'installing %s\n' "$TARGET"
run "mkdir -p '$VERSIONS_DIR'"
run "rm -rf '$TARGET.new' '$TARGET.old'"
run "cp -a '$WORK/unpack' '$TARGET.new'"
if [ -d "$TARGET" ]; then
    note "reinstalling over an existing $STORE_VERSION"
    run "mv -T '$TARGET' '$TARGET.old'"
fi
run "mv -T '$TARGET.new' '$TARGET'"
run "rm -rf '$TARGET.old'"

# rename(2) over the symlink, so there is no instant where `current` is
# missing — a restart racing a deploy finds one version or the other.
run "ln -sfn '$TARGET' '$CURRENT.tmp'"
run "mv -T '$CURRENT.tmp' '$CURRENT'"
note "current -> $STORE_VERSION"

# --- 5. Unit ---------------------------------------------------------------

if [ -f "$UNIT" ] && cmp -s "$WORK/$NAME.service" "$UNIT"; then
    note "$UNIT unchanged"
else
    printf 'installing unit %s\n' "$UNIT"
    run "mkdir -p '$UNIT_DIR'"
    run "cp '$WORK/$NAME.service' '$UNIT'"
    run "systemctl --user daemon-reload"
fi
run "systemctl --user enable '$NAME.service' >/dev/null"

# --- 6. Activate and prove it ---------------------------------------------

if [ "$RESTART" -eq 0 ]; then
    printf 'installed %s %s (not restarted, as asked)\n' "$NAME" "$STORE_VERSION"
    exit 0
fi

run "systemctl --user restart '$NAME.service'"

if [ "$DRY_RUN" -eq 1 ]; then
    printf 'dry run: nothing changed\n'
    exit 0
fi

ok=0
i=0
while [ "$i" -lt 20 ]; do
    if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/board"; then ok=1; break; fi
    i=$((i + 1))
    sleep 1
done
[ "$ok" -eq 1 ] || fail \
    "$NAME did not answer http://127.0.0.1:$PORT/api/board within 20s — check: systemctl --user status $NAME.service"
note "http://127.0.0.1:$PORT/api/board  OK"

# A healthy answer is not proof the restart took: the old process serves
# just as well. The unit's WorkingDirectory is the `current` symlink, so the
# running process's cwd resolves to the versioned directory it is actually
# executing out of — which is the one thing that cannot be stale.
pid=$(systemctl --user show -p MainPID --value "$NAME.service" 2>/dev/null || echo 0)
if [ "${pid:-0}" -gt 0 ] && [ -r "/proc/$pid/cwd" ]; then
    running=$(basename "$(readlink -f "/proc/$pid/cwd")")
    [ "$running" = "$STORE_VERSION" ] || fail \
        "service is answering but running out of $running, not $STORE_VERSION — the restart did not take"
    note "pid $pid running $running"
else
    note "could not read the service's cwd — health check passed, version unproven"
fi

# --- 7. Prune ---------------------------------------------------------------

keep_from=$((KEEP + 1))
for old in $(ls -1t "$VERSIONS_DIR" 2>/dev/null | tail -n "+$keep_from"); do
    [ "$old" != "$STORE_VERSION" ] || continue
    note "pruning $old"
    rm -rf "${VERSIONS_DIR:?}/$old"
done

printf '%s %s is live on :%s (%s)\n' "$NAME" "$STORE_VERSION" "$PORT" "$ORIGIN"

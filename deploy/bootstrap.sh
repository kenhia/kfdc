#!/bin/sh
# kfdc bootstrap — the parts of standing a host up that knarr will never do.
#
# Run ONCE per host, ever. It is not a deploy route, and it refuses to be
# used as one (see the guard below). Deploys go through knarr:
#
#     knarr deploy kfdc --host <host> --shape directory --user \
#         --unit kfdc.service --expect-file build/index.js --ready-cmd '…'
#
# or, from the clone on kai, just `just deploy [version]`.
#
# knarr's boundary is deliberate and this script is its other half (knarr
# D12, decided on korg #1449): knarr ships artifacts, restarts services and
# verifies versions — never unit files, never config. So what is left here
# is exactly two things, both once-ever and both host state:
#
#   1. seed ~/.config/kfdc/kfdc.env from the bundle's template
#   2. install kfdc.service, daemon-reload, enable
#
# Until sprint 013 this file was `install.sh` and did the whole deploy —
# fetch, verify, unpack, repoint, restart, probe, prune. knarr does all of
# that now, for the whole fleet, once.
#
# Usage:
#   bootstrap.sh [--store URL] [--version VER] [--dry-run]
#
#   --store URL   package store base, or $KFDC_STORE_URL. No default, on
#                 purpose: a guessed hostname fails later as a confusing
#                 curl error instead of here as a sentence.
#   --version VER which published bundle to take the unit and template
#                 from; omit to resolve `latest`.
#
# Bootstrapping a host with no checkout — bootstrap.sh is itself
# checksum-verified before it runs, which `curl | sh` cannot offer:
#
#   base="$KFDC_STORE_URL/artifacts/kfdc"
#   v=$(curl -fsS "$base/latest")
#   curl -fsS -O "$base/$v/bootstrap.sh"
#   curl -fsS "$base/$v/SHA256SUMS" | grep ' bootstrap.sh$' | sha256sum -c -
#   sh bootstrap.sh --version "$v"

set -eu

NAME=kfdc
STORE_URL="${KFDC_STORE_URL:-}"
STORE_VERSION=""
DRY_RUN=0

SHARE_DIR="$HOME/.local/share/$NAME"
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
        --store)
            shift; [ $# -gt 0 ] || fail "--store needs a URL"
            STORE_URL="$1" ;;
        --version)
            shift; [ $# -gt 0 ] || fail "--version needs a value"
            STORE_VERSION="$1" ;;
        --dry-run) DRY_RUN=1 ;;
        -h|--help)
            sed -n '2,45p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) fail "unknown argument: $1 (try --help)" ;;
    esac
    shift
done

# --- 0. Refuse to be the deploy route -------------------------------------
#
# The failure this guards against is not hypothetical: a once-ever script
# that still works on the hundredth run quietly becomes the install route,
# and then the fleet has one service that does not deploy through the fleet
# tool. knarr's own deploy/seed.sh holds the same line.

if [ -f "$UNIT" ] && [ -f "$CONF" ]; then
    printf '%s is already bootstrapped on %s:\n' "$NAME" "$(hostname -s)"
    note "unit   $UNIT"
    note "config $CONF"
    if [ -e "$CURRENT" ]; then note "running $(basename "$(readlink -f "$CURRENT")")"; fi
    printf '\nThis is not the deploy route. Install a version with:\n'
    printf '  knarr deploy %s --host %s --shape directory --user --unit %s.service\n' \
        "$NAME" "$(hostname -s)" "$NAME"
    printf 'or, from the clone on kai:  just deploy [version]\n'
    exit 1
fi

for cmd in curl sha256sum systemctl; do
    command -v "$cmd" >/dev/null 2>&1 || fail "$cmd not found on this host; the bootstrap needs it"
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

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM

# --- 2. Fetch and verify the two host-state files -------------------------
#
# The tarball is knarr's to fetch, not this script's. All that is wanted
# here is the unit and the config template.

SUMS=$(curl -fsS "$VERSION_URL/SHA256SUMS") \
    || fail "cannot read $VERSION_URL/SHA256SUMS — is $STORE_VERSION published?"

for f in "$NAME.service" "$NAME.env.example"; do
    curl -fsS -o "$WORK/$f" "$VERSION_URL/$f" \
        || fail "fetch failed: $VERSION_URL/$f — is $STORE_VERSION published with a full bundle?"
    line=$(printf '%s\n' "$SUMS" | grep -E "[[:space:]][*]?$(printf '%s' "$f" | sed 's/[.[\*^$]/\\&/g')\$" | head -1)
    [ -n "$line" ] || fail "$f is not listed in $VERSION_URL/SHA256SUMS"
    ( cd "$WORK" && printf '%s\n' "$line" | sha256sum -c --status - ) \
        || fail "checksum MISMATCH for $f — refusing to install"
    note "$f  checksum OK"
done

# --- 3. Configuration (host state, never shipped, never overwritten) ------

if [ -f "$CONF" ]; then
    note "config $CONF already exists — left untouched"
else
    if [ "$DRY_RUN" -eq 1 ]; then
        note "would seed $CONF from the bundled template"
    else
        mkdir -p "$CONF_DIR"
        cp "$WORK/$NAME.env.example" "$CONF"
        chmod 0600 "$CONF"
        printf 'seeded %s from the bundle template\n' "$CONF"
    fi
fi

# Validated here rather than at deploy time, because knarr does not read a
# service's config and should not start needing to. An empty PORT means the
# adapter silently serves :3000; an unset ORIGIN points every redirect and
# form post at the wrong host.
conf_value() {
    sed -n "s/^[[:space:]]*$1=//p" "$CONF" 2>/dev/null | tail -1 | tr -d "\"' "
}
PORT=$(conf_value PORT)
ORIGIN=$(conf_value ORIGIN)
if [ -z "$PORT" ] || [ -z "$ORIGIN" ] || [ "${ORIGIN#*REPLACE-ME}" != "$ORIGIN" ]; then
    fail "fill in PORT and ORIGIN in $CONF for this host, then re-run.
       PORT must match the tailscale_serve entry declared for $(hostname -s)
       in k-homelab manifests/<host>.yml. ORIGIN ships as a placeholder on
       purpose — a template carrying some other host's URL would pass a
       non-empty check while pointing every redirect at a dead board."
fi
note "config $CONF  PORT=$PORT  ORIGIN=$ORIGIN"

# --- 4. Unit ---------------------------------------------------------------

if [ -f "$UNIT" ] && cmp -s "$WORK/$NAME.service" "$UNIT"; then
    note "$UNIT unchanged"
else
    printf 'installing unit %s\n' "$UNIT"
    run "mkdir -p '$UNIT_DIR'"
    run "cp '$WORK/$NAME.service' '$UNIT'"
    run "systemctl --user daemon-reload"
fi
# `enable` is a statement about boot, not about a deploy — which is exactly
# why it lives here and not in knarr.
run "systemctl --user enable '$NAME.service' >/dev/null"

# Deliberately NOT started: there is no version installed yet. knarr's first
# deploy unpacks one, points `current` at it, and restarts.

printf '\n%s is bootstrapped on %s. Now install a version:\n' "$NAME" "$(hostname -s)"
printf '  knarr deploy %s --host %s --shape directory --user --unit %s.service \\\n' \
    "$NAME" "$(hostname -s)" "$NAME"
printf "      --expect-file build/index.js --ready-cmd '. %s; curl -fs -o /dev/null \"http://127.0.0.1:\$PORT/api/board\"'\n" \
    "~/.config/$NAME/$NAME.env"
printf 'or, from the clone on kai:  just deploy\n'

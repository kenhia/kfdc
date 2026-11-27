#!/bin/sh
# Tests for deploy/bootstrap.sh's --update-unit mode (sprint 027), run by
# `just check`. No dependencies: a fake store on file:// URLs, a fake HOME,
# and a fake `systemctl` on PATH that records what it was asked to do. The
# script under test never knows it is not on a real host.
#
# What is asserted is the brief's contract, case by case: the unit and
# nothing else; a no-op when it matches; no restart unless asked; a checksum
# mismatch installs nothing; and the run-twice refusal still stands for a
# plain bootstrap.

set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
SCRIPT="$HERE/bootstrap.sh"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT INT TERM

FAILS=0
pass() { printf 'ok   %s\n' "$1"; }
bad() { printf 'FAIL %s\n' "$1" >&2; FAILS=$((FAILS + 1)); }

# --- fixtures ---------------------------------------------------------------

STORE="$T/store"
mkdir -p "$STORE/artifacts/kfdc/1.0.0-new" "$T/bin"
printf '1.0.0-new\n' > "$STORE/artifacts/kfdc/latest"
printf '[Service]\nExecStart=/usr/bin/node build/index.js\n# new\n' \
    > "$STORE/artifacts/kfdc/1.0.0-new/kfdc.service"
printf 'PORT=\nORIGIN=https://REPLACE-ME\n' > "$STORE/artifacts/kfdc/1.0.0-new/kfdc.env.example"
( cd "$STORE/artifacts/kfdc/1.0.0-new" && sha256sum kfdc.service kfdc.env.example > SHA256SUMS )

# A version whose unit does not match its SHA256SUMS.
mkdir -p "$STORE/artifacts/kfdc/1.0.0-bad"
cp "$STORE/artifacts/kfdc/1.0.0-new/"* "$STORE/artifacts/kfdc/1.0.0-bad/"
printf '# tampered\n' >> "$STORE/artifacts/kfdc/1.0.0-bad/kfdc.service"

cat > "$T/bin/systemctl" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >> "$SYSTEMCTL_LOG"
exit 0
EOF
chmod +x "$T/bin/systemctl"

OLD_UNIT='[Service]
ExecStart=/usr/bin/node build/index.js
# old
'
ENV_BODY='PORT=8100
ORIGIN=https://example.test:8100
LAN_HOST=192.0.2.1
'

# A bootstrapped host: unit and config both present.
fresh_host() {
    H="$T/home-$1"
    rm -rf "$H"
    mkdir -p "$H/.config/systemd/user" "$H/.config/kfdc"
    printf '%s' "$OLD_UNIT" > "$H/.config/systemd/user/kfdc.service"
    printf '%s' "$ENV_BODY" > "$H/.config/kfdc/kfdc.env"
    UNIT="$H/.config/systemd/user/kfdc.service"
    CONF="$H/.config/kfdc/kfdc.env"
    LOG="$H/systemctl.log"
    : > "$LOG"
    OUT="$H/out"
}

# Run bootstrap.sh as that host. Exit status lands in $RC; output in $OUT.
boot() {
    set +e
    HOME="$H" PATH="$T/bin:$PATH" SYSTEMCTL_LOG="$LOG" KFDC_STORE_URL="file://$STORE" \
        sh "$SCRIPT" "$@" > "$OUT" 2>&1
    RC=$?
    set -e
}

same_file() { cmp -s "$1" "$2"; }
NEW="$STORE/artifacts/kfdc/1.0.0-new/kfdc.service"

# --- cases -------------------------------------------------------------------

fresh_host differs
cp "$CONF" "$T/conf.before"
boot --update-unit
if [ "$RC" -eq 0 ] && same_file "$UNIT" "$NEW"; then pass "a differing unit is installed"; else bad "a differing unit is installed (rc=$RC)"; cat "$OUT" >&2; fi
grep -q '^-# old' "$OUT" && grep -q '^+# new' "$OUT" && pass "the diff is shown" || bad "the diff is shown"
[ "$(cat "$LOG")" = "--user daemon-reload" ] && pass "daemon-reload, and nothing else from systemctl" || bad "daemon-reload only; got: $(cat "$LOG")"
grep -q 'NOT restarted' "$OUT" && pass "says plainly it did not restart" || bad "says plainly it did not restart"
same_file "$CONF" "$T/conf.before" && pass "the env file is untouched" || bad "the env file is untouched"

: > "$LOG"
boot --update-unit
{ [ "$RC" -eq 0 ] && grep -q 'nothing to do' "$OUT" && [ ! -s "$LOG" ]; } \
    && pass "a second run is a no-op that calls no systemctl" || bad "second run is a no-op (rc=$RC, log: $(cat "$LOG"))"

fresh_host restart
boot --update-unit --restart
{ [ "$RC" -eq 0 ] && grep -qx -- '--user restart kfdc.service' "$LOG"; } \
    && pass "--restart restarts after a changed unit" || bad "--restart restarts (rc=$RC, log: $(cat "$LOG"))"
: > "$LOG"
boot --update-unit --restart
{ [ "$RC" -eq 0 ] && [ ! -s "$LOG" ]; } \
    && pass "--restart on a matching unit restarts nothing" || bad "--restart on a match is a no-op (log: $(cat "$LOG"))"

fresh_host dry
boot --update-unit --dry-run
{ [ "$RC" -eq 0 ] && [ "$(cat "$UNIT")" = "$(printf '%s' "$OLD_UNIT")" ] && [ ! -s "$LOG" ] && grep -q '^+# new' "$OUT"; } \
    && pass "--dry-run shows the diff and changes nothing" || bad "--dry-run changes nothing (rc=$RC)"

fresh_host tampered
boot --update-unit --version 1.0.0-bad
{ [ "$RC" -ne 0 ] && grep -q 'MISMATCH' "$OUT" && [ "$(cat "$UNIT")" = "$(printf '%s' "$OLD_UNIT")" ] && [ ! -s "$LOG" ]; } \
    && pass "a checksum mismatch installs nothing" || bad "checksum mismatch refuses (rc=$RC)"

fresh_host unbooted
rm "$UNIT"
boot --update-unit
{ [ "$RC" -ne 0 ] && grep -q 'not bootstrapped' "$OUT" && [ ! -e "$UNIT" ]; } \
    && pass "--update-unit refuses a host with no unit" || bad "--update-unit refuses an unbootstrapped host (rc=$RC)"

fresh_host guard
boot
{ [ "$RC" -ne 0 ] && grep -q 'not the deploy route' "$OUT" && [ ! -s "$LOG" ]; } \
    && pass "a plain re-run still refuses on a bootstrapped host" || bad "run-twice refusal holds (rc=$RC)"

fresh_host orphan
boot --restart
{ [ "$RC" -ne 0 ] && grep -q 'only means something with --update-unit' "$OUT"; } \
    && pass "--restart alone is refused" || bad "--restart alone is refused (rc=$RC)"

if [ "$FAILS" -ne 0 ]; then
    printf '\nbootstrap tests: %d failed\n' "$FAILS" >&2
    exit 1
fi
printf 'bootstrap tests OK\n'

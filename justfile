# KFDC_STORE_URL / KFDC_STORE_HOST / KFDC_DEPLOY_HOST live in .env beside
# KORG_URL.
set dotenv-load := true

# List available recipes
default:
    @just --list

# Run the dev server
dev:
    npm run dev

# Run CI gates: harness invariants + lint + svelte-check + build + test
check: harness
    npm run lint
    npm run check
    npm run build
    npm test

# Auto-format the tree
format:
    npm run format

# One headless curator pass against production korg (curator/prompt.md)
curator:
    bin/update-fdc

# Install + enable the daily curator timer (kmon pattern; units in systemd/)
curator-install:
    mkdir -p ~/.config/systemd/user
    cp systemd/kfdc-curator.service systemd/kfdc-curator.timer ~/.config/systemd/user/
    systemctl --user daemon-reload
    systemctl --user enable --now kfdc-curator.timer
    @systemctl --user list-timers kfdc-curator.timer --no-pager

# Build a release and publish the deploy bundle to the homelab package store
# (k-homelab docs/deploying.md). A host installs by fetching
# artifacts/kfdc/<version>/ — no clone, no npm, no toolchain needed there.
#
# The bundle is the adapter-node output PLUS everything the service needs to
# exist on a bare host: the unit file, the config template, and the bootstrap
# script. adapter-node bundles its own dependencies, so `build/` is genuinely
# self-contained (~2 MB, only node: builtins left) — there is no node_modules
# to ship and no `npm ci` on the target.
#
# Version = package.json version + the short commit, so a published version
# always names a commit that can be checked out — and the commit half means
# no version-bump ceremony is needed to republish. The minor tracks the
# sprint (0.5.0 = sprint 005). The store refuses to
# overwrite a version; from a branch this publishes without moving `latest`,
# which is how a path gets proven before it becomes what the fleet resolves.
publish:
    #!/usr/bin/env bash
    set -euo pipefail
    : "${KFDC_STORE_HOST:?set KFDC_STORE_HOST in .env (the host running kpkg, e.g. kubsdb)}"
    if [[ -n "$(git status --porcelain)" ]]; then
        echo "publish: refusing to publish from a dirty tree — a published version must name a commit" >&2
        exit 1
    fi
    npm run build
    v="$(node -p 'require("./package.json").version')-$(git rev-parse --short HEAD)"
    latest_arg=""
    if [[ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]]; then
        latest_arg="--no-latest"
        echo "publish: not on main — publishing $v WITHOUT moving the latest pointer" >&2
    fi
    stage="$(mktemp -d)"
    trap 'rm -rf "$stage"' EXIT
    mkdir -p "$stage/root"
    cp -a build "$stage/root/build"
    # The stamp knarr checks the published label against — on its own local
    # verified copy, before the host is touched.
    printf '%s\n' "$v" > "$stage/root/VERSION"
    tar -czf "$stage/kfdc-$v.tar.gz" -C "$stage/root" VERSION build
    cp systemd/kfdc.service deploy/bootstrap.sh deploy/kfdc.env.example "$stage/"
    echo "==> publishing kfdc $v ($(du -h "$stage/kfdc-$v.tar.gz" | cut -f1))"
    d=$(ssh -n "$KFDC_STORE_HOST" mktemp -d)
    scp -q "$stage/kfdc-$v.tar.gz" "$stage/kfdc.service" "$stage/bootstrap.sh" \
        "$stage/kfdc.env.example" "$KFDC_STORE_HOST:$d/"
    ssh -n "$KFDC_STORE_HOST" "kpkg artifact $latest_arg kfdc $v $d/* && rm -rf $d"
    echo "published: kfdc $v"

# Deploy the board on the SERVING host from a published bundle (default:
# latest), through knarr — the homelab fleet deploy runner (sprint 013).
#
# knarr runs the whole sequence this recipe used to hand-roll over ssh:
# resolve, fetch, SHA256-verify, assert the tarball's VERSION stamp equals
# the version it was published under — on the LOCAL verified copy, before
# the host is touched — unpack into versions/<v>, repoint `current` by
# rename(2), restart the user unit, poll readiness, confirm by the running
# process's cwd, and prune to --keep 3. Its defaults already match kfdc's
# layout, which is why so little is spelled out here.
#
# What knarr deliberately does NOT do is seed config or install the unit
# (knarr D12, decided on korg #1449). That is `deploy/bootstrap.sh`, run
# once per host, ever — not part of a deploy.
#
# Naming an older version is still the whole rollback: published versions
# are immutable and the last 3 stay unpacked on the host, so it is a
# symlink repoint.
#
# knarr's exit codes are not flattened (knarr D4): 2 means the store failed
# and THE HOST WAS NEVER TOUCHED, 3 that a deploy step failed, 4 that it
# installed but is running the wrong version. That split answers "do I need
# to go look at the host?", so this recipe `exec`s knarr rather than
# wrapping it in anything that could swallow the status.
#
# stdout carries exactly one JSON status document; human progress goes to
# stderr. `deploy-board` reads that document instead of re-probing by hand.
deploy version="":
    #!/usr/bin/env bash
    set -euo pipefail
    : "${KFDC_STORE_URL:?set KFDC_STORE_URL in .env (e.g. https://kubsdb.encke-wahoo.ts.net:4880)}"
    : "${KFDC_DEPLOY_HOST:?set KFDC_DEPLOY_HOST in .env (the host that serves the board, e.g. kubsdb)}"
    if ! command -v knarr >/dev/null; then
        echo "deploy: knarr is not on PATH — kfdc deploys through it since sprint 013" >&2
        echo "  upgrade an existing host:  knarr deploy knarr --host <host>" >&2
        echo "  seed a host with none:     knarr's deploy/seed.sh" >&2
        exit 1
    fi
    # knarr's own word for "this machine"; anything else it reaches by ssh.
    host="$KFDC_DEPLOY_HOST"
    if [[ "$host" == "$(hostname -s)" ]]; then host=local; fi
    args=(deploy kfdc --host "$host" --store "$KFDC_STORE_URL"
          --shape directory --user --unit kfdc.service
          --expect-file build/index.js)
    if [[ -n "{{ version }}" ]]; then args+=(--version "{{ version }}"); fi
    # PORT is host state (~/.config/kfdc/kfdc.env) and not the clone's to
    # know. knarr never reads a service's config to work out how to probe
    # it, so the probe reads it on the target — a clone that hard-coded the
    # port would go on probing the old one after a host move and call it
    # healthy.
    args+=(--ready-cmd '. ~/.config/kfdc/kfdc.env; curl -fs -o /dev/null "http://127.0.0.1:$PORT/api/board"')
    exec knarr "${args[@]}"

# What the store holds, and what the SERVING host has unpacked and is
# running. Three views of one version; if they disagree, which one disagrees
# is the whole diagnostic.
versions:
    #!/usr/bin/env bash
    set -euo pipefail
    : "${KFDC_STORE_HOST:?set KFDC_STORE_HOST in .env}"
    : "${KFDC_DEPLOY_HOST:?set KFDC_DEPLOY_HOST in .env}"
    echo "store:"
    ssh -n "$KFDC_STORE_HOST" 'kpkg list' | sed -n 's/^artifacts\/kfdc: /  /p'
    echo "serving host: $KFDC_DEPLOY_HOST"
    if [[ "$KFDC_DEPLOY_HOST" == "$(hostname -s)" ]]; then
        bash -s <<'HERE'
    echo "here:"
    ls -1t ~/.local/share/kfdc/versions 2>/dev/null | sed 's/^/  /' || echo "  (none)"
    echo "running: $(basename "$(readlink -f ~/.local/share/kfdc/current 2>/dev/null)" 2>/dev/null || echo none)"
    HERE
    else
        ssh "$KFDC_DEPLOY_HOST" bash -s <<'HERE'
    echo "here:"
    ls -1t ~/.local/share/kfdc/versions 2>/dev/null | sed 's/^/  /' || echo "  (none)"
    echo "running: $(basename "$(readlink -f ~/.local/share/kfdc/current 2>/dev/null)" 2>/dev/null || echo none)"
    HERE
    fi

# Harness invariants — still guard the kproject managed block and design docs
harness:
    @test -f CLAUDE.md
    @test -f .github/copilot-instructions.md
    @grep -q "kproject:begin" CLAUDE.md
    @grep -q "kproject:begin" .github/copilot-instructions.md
    @grep -qx "\.scratch/" .gitignore
    @grep -qx "\.env" .gitignore
    @test -f sprints/planning/roadmap.md
    @test -f docs/design.md
    @test -f docs/design/kfdc-concept.html
    @test -x deploy/bootstrap.sh
    @test -f systemd/kfdc.service
    @test -f .sprint-deploy
    @for s in $(grep -vE '^[[:space:]]*(#|$)' .sprint-deploy); do test -f ".claude/skills/$s/SKILL.md" || { echo "harness: .sprint-deploy names '$s' but .claude/skills/$s/SKILL.md is missing" >&2; exit 1; }; done
    @echo "harness invariants OK"

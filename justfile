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
# exist on a bare host: the unit file, the config template, and the installer
# itself. adapter-node bundles its own dependencies, so `build/` is genuinely
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
    # The stamp the installer checks the published label against.
    printf '%s\n' "$v" > "$stage/root/VERSION"
    tar -czf "$stage/kfdc-$v.tar.gz" -C "$stage/root" VERSION build
    cp systemd/kfdc.service deploy/install.sh deploy/kfdc.env.example "$stage/"
    echo "==> publishing kfdc $v ($(du -h "$stage/kfdc-$v.tar.gz" | cut -f1))"
    d=$(ssh -n "$KFDC_STORE_HOST" mktemp -d)
    scp -q "$stage/kfdc-$v.tar.gz" "$stage/kfdc.service" "$stage/install.sh" \
        "$stage/kfdc.env.example" "$KFDC_STORE_HOST:$d/"
    ssh -n "$KFDC_STORE_HOST" "kpkg artifact $latest_arg kfdc $v $d/* && rm -rf $d"
    echo "published: kfdc $v"

# Deploy the board on the SERVING host from a published bundle (default:
# latest). Naming an older version is the rollback — the store is the
# history, and the last few unpacked versions stay on disk for a
# symlink-fast one.
#
# `KFDC_DEPLOY_HOST` names the serving host, because the clone and the
# service stopped being on the same machine in sprint 009 (kai -> kubsdb).
# It has no default for the same reason the store variables do not: a
# guessed host installs the board somewhere nobody is looking and reports
# success. When it names this machine the installer runs here; otherwise
# the *documented bootstrap* runs over ssh — the serving host fetches its
# own install.sh and checksum-verifies it before running it. Nothing is
# copied from this clone, because a clone-less serving host is the entire
# point of deploying from the store.
deploy version="":
    #!/usr/bin/env bash
    set -euo pipefail
    : "${KFDC_STORE_URL:?set KFDC_STORE_URL in .env (e.g. https://kubsdb.encke-wahoo.ts.net:4880)}"
    : "${KFDC_DEPLOY_HOST:?set KFDC_DEPLOY_HOST in .env (the host that serves the board, e.g. kubsdb)}"
    if [[ "$KFDC_DEPLOY_HOST" == "$(hostname -s)" ]]; then
        args=(--from-store)
        if [[ -n "{{ version }}" ]]; then args+=(--version "{{ version }}"); fi
        deploy/install.sh "${args[@]}"
    else
        echo "==> deploying on $KFDC_DEPLOY_HOST (this clone is not the serving host)"
        ssh "$KFDC_DEPLOY_HOST" bash -s -- "$KFDC_STORE_URL" "{{ version }}" <<'REMOTE'
    set -eu
    store="$1"; want="${2:-}"
    base="$store/artifacts/kfdc"
    if [ -z "$want" ]; then
        want=$(curl -fsS "$base/latest" | tr -d '[:space:]') \
            || { echo "cannot read $base/latest from $(hostname -s)" >&2; exit 1; }
    fi
    work=$(mktemp -d)
    trap 'rm -rf "$work"' EXIT INT TERM
    cd "$work"
    curl -fsS -O "$base/$want/install.sh"
    curl -fsS "$base/$want/SHA256SUMS" | grep ' install.sh$' | sha256sum -c -
    KFDC_STORE_URL="$store" sh install.sh --from-store --version "$want"
    REMOTE
    fi

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
    @test -x deploy/install.sh
    @test -f systemd/kfdc.service
    @test -f .sprint-deploy
    @for s in $(grep -vE '^[[:space:]]*(#|$)' .sprint-deploy); do test -f ".claude/skills/$s/SKILL.md" || { echo "harness: .sprint-deploy names '$s' but .claude/skills/$s/SKILL.md is missing" >&2; exit 1; }; done
    @echo "harness invariants OK"

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

# Rebuild and restart the board on kai (unit kfdc.service; serve config in sprint 001)
deploy:
    npm run build
    systemctl --user restart kfdc.service
    @sleep 1 && curl -sf http://127.0.0.1:8100/api/board >/dev/null
    @echo "deployed: https://kai.encke-wahoo.ts.net:8100"

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
    @echo "harness invariants OK"

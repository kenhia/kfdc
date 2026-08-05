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

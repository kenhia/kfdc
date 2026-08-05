# List available recipes
default:
    @just --list

# Run CI gates — harness invariants only until the SvelteKit stack lands
# (roadmap Phase 1 rewires this to lint + svelte-check + build + test)
check:
    @test -f CLAUDE.md
    @test -f .github/copilot-instructions.md
    @grep -q "kproject:begin" CLAUDE.md
    @grep -q "kproject:begin" .github/copilot-instructions.md
    @grep -qx "\.scratch/" .gitignore
    @grep -qx "\.env" .gitignore
    @test -f sprints/planning/roadmap.md
    @test -f docs/design.md
    @test -f docs/design/kfdc-concept.html
    @echo "check: harness invariants OK (stack gates pending — see roadmap Phase 1)"

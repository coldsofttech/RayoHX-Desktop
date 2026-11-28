## What does this change?

<!-- Briefly describe the change and why it is needed. -->

## Which part is affected?

- [ ] API (`packages/api`)
- [ ] Desktop window (`packages/desktop`, Python)
- [ ] Front end (`packages/desktop/src/rayohx_desktop/ui`)
- [ ] Windows setup or portable zip (`installer/`, `scripts/build.py`)
- [ ] Repository, workflows or docs (everything outside `packages/`)

## Related issues

<!-- e.g. Closes #123 -->

## Checklist

- [ ] The change is focused on one thing
- [ ] `CHANGELOG.md` has a short `[Unreleased]` entry
- [ ] README or docs are updated if behavior changed
- [ ] No secrets or personal data are included
- [ ] API changes: `docs/openapi.json` is regenerated and `docs/api.md` is updated
- [ ] UI changes: `npm run lint`, `npm test` and `npm run build` pass in `packages/desktop/src/rayohx_desktop/ui`
- [ ] Installer changes: `python scripts/build.py --setup` builds, and the setup installs and uninstalls cleanly
- [ ] Workflow changes: `actionlint` passes

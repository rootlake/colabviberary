# CoLab · The Vibe-rary

Card-catalog gallery of teacher-made **vibe-coded** projects for **[AI Co-Lab](https://educolab.org/)**. **v2** ships as **`index.html`** (HTML + inline JS), **`css/vibe-rary.css`**, and **`assets/`**.

**Live site:** [rootlake.github.io/colabviberary](https://rootlake.github.io/colabviberary/)  
**Repository:** [github.com/rootlake/colabviberary](https://github.com/rootlake/colabviberary)

**GitHub Pages:** branch **`main`**, **`/` (root)**. **`.nojekyll`** is included so static files are served as-is.

---

## Deploy updates

From the repo root:

```bash
./scripts/push-pages.sh
```

With a custom commit message:

```bash
./scripts/push-pages.sh "Add a new catalog entry"
```

Overrides: `PAGES_REMOTE`, `PAGES_BRANCH` (defaults: `origin`, `main`).

---

## Editing content

Near the bottom of `index.html`, edit the **`VIBRARY_ENTRIES`** array. Each entry can use the same fields as before (for example `slug`, `url`, `title`, `abstract`, `discipline`, `format`, `subjectHeading`, `callNumber`, `contributor`, `previewImage`, `cohortYear`, `omitPrompt`, `promptEssence`). Add preview images under **`assets/`** and reference them with paths like `assets/your-file.png`.

---

## Layout & theming (v2 · skeuomorphic)

- **Fonts (Google):** IBM Plex Mono, Cormorant Garamond, Playfair Display, Special Elite — linked from `index.html`.
- **Theme tokens** live in **`css/vibe-rary.css`** under `:root` (`--leather-*`, `--walnut-*`, `--felt-*`, `--brass`, `--gilt-edge`, paper/ink colors).
- **Classic v1:** kept as [`indexORIG.html`](indexORIG.html). The floating **“View v1 →”** link on the live site points there.
- **Earlier repo README** (deploy-only): [`READMEORIG.md`](READMEORIG.md).
- **Design handoff notes** (folder-style instructions, v1 vs v2 table) lived in the Claude package; the important bits are summarized above.

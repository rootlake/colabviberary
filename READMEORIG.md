# CoLab Vibe-rary

Static gallery (`index.html` + `assets/`).

**Live site:** [https://rootlake.github.io/colabviberary/](https://rootlake.github.io/colabviberary/)  
**Repo:** [github.com/rootlake/colabviberary](https://github.com/rootlake/colabviberary)

**GitHub Pages** (already configured): deploy from branch **`main`**, folder **`/ (root)`**.

## Update the site

After editing `index.html` or adding images under `assets/`:

```bash
./scripts/push-pages.sh
```

Optional custom commit message:

```bash
./scripts/push-pages.sh "Add Diana Curtis evidence brainstorm card"
```

Remote/branch override (defaults: `origin`, `main`):

```bash
PAGES_REMOTE=origin PAGES_BRANCH=main ./scripts/push-pages.sh
```

(function () {
  'use strict';

  const LABELS = {
    coaching: {
      tutor: 'Walk me through it like a tutor',
      justdoit: 'Just do it — prioritize a working result',
      balanced: 'Balanced — brief teaching, then build',
    },
    tool: {
      'claude-chat': 'Claude (chat / web)',
      'claude-desktop': 'Claude Desktop',
      'claude-code': 'Claude Code',
      cursor: 'Cursor',
      chatgpt: 'ChatGPT',
      gemini: 'Gemini',
      codex: 'Codex',
      other: 'another AI coding tool',
    },
    build: {
      'single-html': 'a single-file web page (HTML/CSS/JavaScript)',
      'multi-page': 'a multi-page website (HTML/CSS/JS)',
      'apps-script': 'a Google Apps Script project',
      extension: 'a browser extension (Chrome/Edge)',
      'mobile-pwa': 'a phone-friendly progressive web app (PWA)',
      framework: 'a framework app (e.g. React + Vite)',
      fullstack: 'a full-stack app with a database',
    },
    hosting: {
      local: 'run locally on my computer only',
      'email-file': 'share as a file (email / Drive / AirDrop)',
      'github-pages': 'publish on GitHub Pages',
      'netlify-vercel': 'deploy on Netlify, Vercel, or a drag-and-drop host',
      'apps-script-web': 'deploy as a Google Apps Script web app',
      'school-lms': 'share via school LMS / Classroom / intranet',
    },
    device: {
      laptop: 'laptop / desktop browser',
      phone: 'phone browser (Safari/Chrome web — not a native App Store app)',
      ipad: 'iPad browser (Safari web, touch-friendly — not Xcode / native)',
      projector: 'projector / classroom big screen',
    },
    flavor: {
      'interactive-tool': 'interactive tool, calculator, or practice activity',
      game: 'game, choose-your-path story, or escape room',
      dashboard: 'dashboard or visual built from a spreadsheet',
      automation: 'automation / workflow helper',
      simulation: 'simulation or manipulable model',
      creative: 'creative / generative piece',
    },
    guards: {
      'no-pii': 'Collect no personal or student data; use sample data by default.',
      'no-accounts': 'No logins or user accounts unless I explicitly ask.',
      'no-paid-apis': 'No paid API keys or paid third-party services.',
      accessible: 'Prefer accessible design: keyboard use, contrast, plain language.',
      'school-privacy': 'If school or student data is truly needed, pause and tell me to check with my school technology/privacy lead before building that part.',
      'offline-first': 'Prefer designs that work offline or on flaky classroom Wi‑Fi.',
    },
  };

  const MODE_DEFAULTS = {
    beginner: {
      coaching: 'tutor',
      tool: 'claude-chat',
      build: 'single-html',
      hosting: 'email-file',
      device: ['laptop'],
      flavor: [],
      guards: ['no-pii', 'no-accounts', 'no-paid-apis', 'accessible'],
      extras: ['progress-summary', 'blueprint', 'test-checklist', 'canvas-mode'],
    },
    advanced: {
      coaching: 'balanced',
      tool: 'claude-desktop',
      build: 'multi-page',
      hosting: 'github-pages',
      device: ['laptop', 'phone'],
      flavor: [],
      guards: ['no-pii', 'accessible'],
      extras: ['progress-summary', 'blueprint', 'test-checklist', 'canvas-mode', 'explain-diffs'],
    },
  };

  const CLAUDE_TOOLS = new Set(['claude-chat', 'claude-desktop']);
  const CANVAS_TOOLS = new Set(['claude-chat', 'claude-desktop', 'chatgpt', 'gemini', 'other']);

  const MODE_HINTS = {
    beginner: 'Beginner mode keeps the path short: one HTML file you can open or email. Advanced options stay visible but muted.',
    advanced: 'Advanced mode unlocks the full menu. Starting guess: Claude Desktop, multi-page site, GitHub Pages.',
  };

  const form = document.getElementById('pb-form');
  const preview = document.getElementById('prompt-preview');
  const copyBtn = document.getElementById('copy-btn');
  const copyBtnBottom = document.getElementById('copy-btn-bottom');
  const selectBtn = document.getElementById('select-all-btn');
  const copyStatus = document.getElementById('copy-status');
  const modeHint = document.getElementById('mode-hint');
  const page = document.body;
  const copyButtons = [copyBtn, copyBtnBottom].filter(Boolean);

  let mode = 'beginner';
  let applyingDefaults = false;

  function selectedRadio(name) {
    const el = form.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  }

  function selectedChecks(name) {
    return Array.from(form.querySelectorAll(`input[name="${name}"]:checked`)).map((el) => el.value);
  }

  function setRadio(name, value) {
    const el = form.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  }

  function setChecks(name, values) {
    form.querySelectorAll(`input[name="${name}"]`).forEach((el) => {
      el.checked = values.includes(el.value);
    });
  }

  function applyModeDefaults(nextMode) {
    const d = MODE_DEFAULTS[nextMode];
    applyingDefaults = true;
    setRadio('coaching', d.coaching);
    setRadio('tool', d.tool);
    setRadio('build', d.build);
    setRadio('hosting', d.hosting);
    setChecks('device', d.device);
    setChecks('flavor', d.flavor);
    setChecks('guards', d.guards);
    setChecks('extras', d.extras);
    applyingDefaults = false;
  }

  function syncAdvancedAvailability() {
    const advanced = mode === 'advanced';
    form.querySelectorAll('[data-level="advanced"] input').forEach((input) => {
      input.disabled = !advanced;
      if (!advanced && input.checked) {
        // Fall back to a beginner-safe choice in the same group
        const name = input.name;
        if (input.type === 'radio') {
          const beginnerChoice = MODE_DEFAULTS.beginner[name];
          if (beginnerChoice) setRadio(name, beginnerChoice);
        } else {
          input.checked = false;
        }
      }
    });
  }

  function setMode(nextMode, applyDefaults) {
    mode = nextMode;
    page.dataset.mode = nextMode;
    document.querySelectorAll('.pb-mode-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.mode === nextMode);
    });
    modeHint.textContent = MODE_HINTS[nextMode];
    if (applyDefaults) applyModeDefaults(nextMode);
    syncAdvancedAvailability();
    render();
  }

  function toolCapabilityNote(tool, canvasOn) {
    const base = {
      'claude-chat': 'You are in Claude chat (web). Prefer complete, copy-pasteable code (ideally one HTML file).',
      'claude-desktop': 'I am in Claude Desktop. Prefer creating/saving project files when possible, and keep the structure clear.',
      'claude-code': 'I am in Claude Code (terminal agent). Create files in the project folder, run previews when useful, and fix errors before handing off.',
      cursor: 'I am in Cursor. Create and edit files in the workspace, use the local preview when helpful, and keep changes reviewable.',
      chatgpt: 'You are in ChatGPT. Prefer complete, copy-pasteable code.',
      gemini: 'You are in Gemini. Prefer complete, copy-pasteable code.',
      codex: 'I am in a Codex-style coding agent. Create files, run what you can, and keep the project runnable.',
      other: 'Figure out what you can do here (save files, preview, or only write copy-paste code) and tell me in 2–3 sentences what that means for the build.',
    };

    let note = base[tool] || base.other;

    if (CANVAS_TOOLS.has(tool)) {
      if (canvasOn) {
        if (CLAUDE_TOOLS.has(tool)) {
          note += ' Prefer Claude Artifacts for interactive previews and editable code when available; also give me a clean copy I can save as a file.';
        } else if (tool === 'chatgpt') {
          note += ' Prefer Canvas for live editing/preview when available; also give me a clean copy I can save as a file.';
        } else if (tool === 'gemini') {
          note += ' Prefer Canvas / interactive preview when available; also give me a clean copy I can save as a file.';
        } else {
          note += ' Prefer Canvas, Artifacts, or any live preview pane when available; also give me a clean copy I can save as a file.';
        }
      } else if (CLAUDE_TOOLS.has(tool)) {
        note += ' Do not rely on Artifacts — put full code in the chat (or files) so I can copy it.';
      } else if (tool === 'chatgpt' || tool === 'gemini' || tool === 'other') {
        note += ' Do not rely on Canvas — put full code in the chat so I can copy it.';
      }
    }

    return note;
  }

  function canvasBlock(tool, canvasOn) {
    if (!CANVAS_TOOLS.has(tool)) return '';

    const lines = ['PREVIEW MODE'];
    if (canvasOn) {
      if (CLAUDE_TOOLS.has(tool)) {
        lines.push('- Canvas / Artifacts: ON — use Claude Artifacts for the working preview whenever it helps.');
        lines.push('- Still provide complete source I can download or copy into a local file.');
      } else if (tool === 'chatgpt') {
        lines.push('- Canvas mode: ON — use ChatGPT Canvas for the working preview whenever it helps.');
        lines.push('- Still provide complete source I can download or copy into a local file.');
      } else if (tool === 'gemini') {
        lines.push('- Canvas mode: ON — use Gemini Canvas / interactive preview whenever it helps.');
        lines.push('- Still provide complete source I can download or copy into a local file.');
      } else {
        lines.push('- Canvas / Artifacts mode: ON — use the tool’s live preview pane when available.');
        lines.push('- Still provide complete source I can download or copy into a local file.');
      }
    } else if (CLAUDE_TOOLS.has(tool)) {
      lines.push('- Artifacts: OFF — skip Artifacts; deliver full code in chat or project files for copy/paste.');
    } else {
      lines.push('- Canvas mode: OFF — skip Canvas; deliver full code in chat for copy/paste.');
    }
    return lines.join('\n');
  }

  function deviceConstraints(devices) {
    if (!devices.length) return [];
    const lines = [];
    if (devices.includes('phone') || devices.includes('ipad')) {
      lines.push('- This is web-in-the-browser only — do not build a native iOS/Android app, and do not use Xcode, Swift, or App Store packaging.');
      lines.push('- Design mobile-first / touch-friendly layouts (large tap targets, readable type, no hover-only controls).');
    }
    if (devices.includes('phone')) {
      lines.push('- Phone: assume a narrow viewport (~390px); test stacked single-column layouts.');
    }
    if (devices.includes('ipad')) {
      lines.push('- iPad: support portrait and landscape; use space well without assuming a mouse.');
    }
    if (devices.includes('projector')) {
      lines.push('- Projector: high contrast, large type, minimal clutter so it reads from the back of the room.');
    }
    return lines;
  }

  function coachingBlock(style) {
    if (style === 'justdoit') {
      return [
        'COACHING STYLE: Just do it',
        '- Prioritize a working Version 1 quickly.',
        '- Ask at most a few clarifying questions only if blocked; otherwise use sensible defaults and list assumptions.',
        '- Skip long tutorials. Keep explanations to one short line when a decision matters.',
        '- You may write code as soon as the idea and pathway are clear.',
      ].join('\n');
    }
    if (style === 'balanced') {
      return [
        'COACHING STYLE: Balanced',
        '- Ask one question at a time when shaping the idea, but keep it moving.',
        '- Give a one-line "Why this matters" only for key decisions.',
        '- After the blueprint (if requested), build Version 1 without over-explaining.',
        '- Start messages with a short progress tag like [Stage 2: Shape].',
      ].join('\n');
    }
    return [
      'COACHING STYLE: Tutor',
      '- Work through stages in order. Ask ONE question at a time and wait for my answer.',
      '- Start every message with a progress tag, e.g. [Stage 2 of 6: Shape].',
      '- Keep messages short and in plain language. Explain any technical term in one line.',
      '- When offering choices, give 2–4 numbered options plus "something else," and mark your recommendation.',
      '- At each stage, add one sentence labeled "Why this matters."',
      '- Do not write code until the Build stage unless I say "build it now."',
    ].join('\n');
  }

  function stagesBlock(coaching, extras) {
    const wantBlueprint = extras.includes('blueprint');
    const wantTests = extras.includes('test-checklist');
    const wantExtensive = extras.includes('extensive-testing');
    const lines = [];

    lines.push('STAGES');
    lines.push('Stage 0 — Check your tools: briefly say what you can do in this environment, then continue.');
    lines.push('Stage 1 — Spark: clarify what I want to make (or help me find a problem worth solving). Turn it into one sentence: "A ___ that helps ___ do ___."');
    lines.push('Stage 2 — Shape: who uses it, on what device, step-by-step flow, what they walk away with, look-and-feel, and whether it must remember anything between visits.');

    if (coaching === 'justdoit') {
      lines.push('Stage 3 — Path: pick the pathway that matches my selections below (confirm once), run a quick feasibility & safety check, then proceed.');
    } else {
      lines.push('Stage 3 — Choose a path: summarize in 3–5 bullets, propose pathways that fit, recommend one, run a Feasibility & Safety check, and confirm before the blueprint.');
    }

    if (wantBlueprint) {
      lines.push('Stage 4 — Blueprint: write a concise BLUEPRINT covering purpose, users/flow, v1 must-haves vs later, look-and-feel, pathway, privacy notes' + (wantTests || wantExtensive ? ', and a test plan' : '') + '. Save it if you can; otherwise display it for copy.');
    } else {
      lines.push('Stage 4 — Plan briefly: list v1 must-haves in 5 bullets or fewer, then build.');
    }

    lines.push('Stage 5 — Build Version 1: smallest thing that works. Keep code simple, readable, and lightly commented. Prefer built-in browser features over external services when possible.');
    if (wantTests && !wantExtensive) {
      lines.push('Then give beginner-friendly open/run steps plus 3 quick things to test.');
    } else if (!wantExtensive) {
      lines.push('Then give beginner-friendly open/run steps.');
    } else {
      lines.push('Then give beginner-friendly open/run steps.');
    }

    if (wantExtensive) {
      lines.push('Stage 5b — Extensive testing: after Version 1 runs, walk me through a fuller test pass (happy path, edge cases, mobile/touch if relevant, broken links, empty states, and anything likely to fail in a classroom). Fix issues you find before we move on.');
    }

    lines.push('Stage 6 — Iterate: suggest 3 next improvements, recommend one, and teach the improvement loop (what I see vs expected → screenshot/error → ask you to change it).');
    return lines.join('\n');
  }

  function shortcutsBlock(extras) {
    const lines = [
      'SHORTCUTS I CAN USE ANYTIME',
      '- "surprise me" = you suggest ideas',
      '- "skip" = use your best default',
      '- "explain" = go deeper on the last point',
      '- "build it now" = jump to building',
    ];
    if (extras.includes('progress-summary')) {
      lines.push('- "pause" = give me a PROGRESS SUMMARY (one-sentence idea, decisions so far, open questions, exact stage to resume). Format it so I can paste it with this prompt into a new chat later.');
    }
    return lines.join('\n');
  }

  function buildPrompt() {
    const idea = (document.getElementById('idea-text').value || '').trim();
    const coaching = selectedRadio('coaching');
    const tool = selectedRadio('tool');
    const build = selectedRadio('build');
    const hosting = selectedRadio('hosting');
    const devices = selectedChecks('device');
    const flavors = selectedChecks('flavor');
    const guards = selectedChecks('guards');
    const extras = selectedChecks('extras');
    const canvasOn = extras.includes('canvas-mode');

    const parts = [];

    parts.push('ROLE');
    parts.push('You are my build partner and coach: a senior product designer, full-stack developer, and patient teacher of educators. I am an educator (teacher, administrator, coach, or staff). Help me turn an idea into something that works' + (coaching === 'justdoit' ? ' quickly.' : ', and help me understand decisions so I can do this again.'));
    parts.push('');
    parts.push('If I paste a PROGRESS SUMMARY or BLUEPRINT along with this prompt, skip to the stage it names and continue from there.');
    parts.push('');

    parts.push('MY SETUP');
    parts.push('- AI tool: ' + LABELS.tool[tool]);
    parts.push('- ' + toolCapabilityNote(tool, canvasOn));
    parts.push('- Target build: ' + LABELS.build[build]);
    parts.push('- Hosting / sharing: ' + LABELS.hosting[hosting]);
    if (devices.length) {
      parts.push('- Primary screen(s): ' + devices.map((d) => LABELS.device[d]).join('; '));
    }
    if (flavors.length) {
      parts.push('- Project flavor(s): ' + flavors.map((f) => LABELS.flavor[f]).join('; '));
    }
    if (idea) {
      parts.push('- Starting idea: ' + idea);
    } else {
      parts.push('- Starting idea: (not specified — help me find one in Stage 1)');
    }
    parts.push('');

    const previewMode = canvasBlock(tool, canvasOn);
    if (previewMode) {
      parts.push(previewMode);
      parts.push('');
    }

    parts.push(coachingBlock(coaching));
    parts.push('');
    parts.push(shortcutsBlock(extras));
    parts.push('');

    parts.push('PATH CONSTRAINTS');
    parts.push('- Default to the target build and hosting above unless they are a poor fit; if so, say why and offer 1–2 alternatives.');
    parts.push('- Design for educators and learners. Prefer simple, readable code over clever abstractions.');
    deviceConstraints(devices).forEach((line) => parts.push(line));
    if (build === 'single-html') {
      parts.push('- Prefer a single self-contained HTML file with inline or embedded CSS/JS when feasible.');
    }
    if (build === 'apps-script' || hosting === 'apps-script-web') {
      parts.push('- Prefer Google Apps Script patterns that an educator can paste into script.google.com and deploy.');
    }
    if (build === 'fullstack') {
      parts.push('- If a database is truly needed for v1, prefer the lightest option and explain tradeoffs; otherwise offer a no-DB workaround for Version 1.');
    }
    parts.push('');

    parts.push('GUARDRAILS');
    if (guards.length) {
      guards.forEach((g) => parts.push('- ' + LABELS.guards[g]));
    } else {
      parts.push('- Default to designs that collect no personal data and need no accounts.');
    }
    parts.push('');

    if (extras.includes('explain-diffs')) {
      parts.push('CHANGE NOTES');
      parts.push('- When you change code, briefly explain each meaningful change in plain English.');
      parts.push('');
    }

    parts.push(stagesBlock(coaching, extras));
    parts.push('');
    parts.push('Begin with Stage 0, then ask your first Stage 1 question' + (idea ? ' (you already have my starting idea above)' : '') + '.');

    return parts.join('\n');
  }

  function render() {
    preview.textContent = buildPrompt();
  }

  async function copyPrompt() {
    const text = preview.textContent;
    try {
      await navigator.clipboard.writeText(text);
      copyButtons.forEach((btn) => {
        btn.classList.add('is-copied');
        btn.textContent = 'Copied';
      });
      copyStatus.textContent = 'Prompt copied — paste it into your AI tool.';
      setTimeout(() => {
        copyButtons.forEach((btn) => {
          btn.classList.remove('is-copied');
          btn.textContent = 'Copy prompt';
        });
      }, 1800);
    } catch (err) {
      // Fallback: select the pre contents
      const range = document.createRange();
      range.selectNodeContents(preview);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      copyStatus.textContent = 'Clipboard blocked — prompt selected; press ⌘C / Ctrl+C.';
    }
  }

  document.querySelectorAll('.pb-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setMode(btn.dataset.mode, true);
    });
  });

  form.addEventListener('change', () => {
    if (applyingDefaults) return;
    render();
  });
  form.addEventListener('input', () => {
    if (applyingDefaults) return;
    render();
  });

  copyButtons.forEach((btn) => btn.addEventListener('click', copyPrompt));
  selectBtn.addEventListener('click', () => {
    const range = document.createRange();
    range.selectNodeContents(preview);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    preview.focus();
    copyStatus.textContent = 'Selected — press ⌘C / Ctrl+C to copy.';
  });

  // Init
  setMode('beginner', true);
})();

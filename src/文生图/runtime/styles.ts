const STYLE_ID = 'tti-image-runtime-style-v1';

function getTopDocument(): Document {
  return window.parent && window.parent !== window ? window.parent.document : document;
}

export function injectImageWorkbenchRuntimeStyles(): void {
  const targetDocument = getTopDocument();
  if (targetDocument.getElementById(STYLE_ID)) {
    return;
  }

  const style = targetDocument.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .tti-image-inline-slot {
      display: block;
      margin: 0.7em 0;
      padding: 0.8em 0.9em;
      border-radius: 16px;
      border: 1px solid rgba(114, 182, 255, 0.18);
      background:
        linear-gradient(180deg, rgba(114, 182, 255, 0.08), rgba(255, 255, 255, 0.02)),
        rgba(8, 16, 24, 0.72);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
    }

    .tti-image-inline-slot.is-generating {
      border-color: rgba(255, 184, 107, 0.4);
    }

    .tti-image-inline-slot.is-success {
      border-color: rgba(127, 231, 167, 0.26);
    }

    .tti-image-inline-slot.is-error {
      border-color: rgba(255, 140, 140, 0.32);
    }

    .tti-image-inline-slot__header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .tti-image-inline-slot__pill,
    .tti-image-inline-slot__status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0.28em 0.65em;
      border-radius: 999px;
      font-size: 0.78em;
      background: rgba(255, 255, 255, 0.06);
      color: inherit;
    }

    .tti-image-inline-slot__pill {
      color: #8ad2ff;
    }

    .tti-image-inline-slot__status.ok {
      color: #7fe7a7;
    }

    .tti-image-inline-slot__status.warn {
      color: #ffb86b;
    }

    .tti-image-inline-slot__status.error {
      color: #ff9d9d;
    }

    .tti-image-inline-slot__toggle,
    .tti-image-inline-slot__action {
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.05);
      color: inherit;
      padding: 0.35em 0.85em;
      cursor: pointer;
      font-size: 0.82em;
    }

    .tti-image-inline-slot__action {
      border-color: rgba(114, 182, 255, 0.24);
    }

    .tti-image-inline-slot__action[disabled] {
      cursor: wait;
      opacity: 0.7;
    }

    .tti-image-inline-slot__toggle {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .tti-image-inline-slot__toggle-caret {
      font-size: 0.92em;
      line-height: 1;
      opacity: 0.88;
    }

    .tti-image-inline-slot__body {
      display: none;
      margin-top: 10px;
    }

    .tti-image-inline-slot.is-expanded .tti-image-inline-slot__body {
      display: block;
    }

    .tti-image-inline-slot__prompt {
      display: block;
      margin-bottom: 8px;
      line-height: 1.65;
      color: var(--SmartThemeBodyColor, inherit);
      opacity: 0.92;
      white-space: pre-wrap;
    }

    .tti-image-inline-slot__meta {
      display: block;
      margin-bottom: 8px;
      font-size: 0.82em;
      color: var(--SmartThemeEmColor, #9bb0c3);
    }

    .tti-image-inline-slot__image {
      display: block;
      width: min(100%, 680px);
      max-width: 100%;
      margin-top: 8px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(0, 0, 0, 0.24);
    }

    .tti-image-inline-summary {
      margin-top: 0.9em;
      padding-top: 0.9em;
      border-top: 1px dashed rgba(255, 255, 255, 0.12);
    }

    .tti-image-inline-summary__title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 0.85em;
      color: var(--SmartThemeEmColor, #9bb0c3);
    }
  `;

  targetDocument.head.appendChild(style);
}

const THEME_KEY = 'purgo.theme'; // 'dark' | 'light' | 'system'
const ACCENT_KEY = 'purgo.accent';

const ACCENT_PRESETS = {
  mint: { accent: '#3ddc97', accentDim: '#2a9d6f', label: 'Mint' },
  blue: { accent: '#4f8cff', accentDim: '#3566cc', label: 'Blau' },
  purple: { accent: '#a78bfa', accentDim: '#7c5fd6', label: 'Violett' },
  orange: { accent: '#f0954a', accentDim: '#c9702a', label: 'Orange' },
  pink: { accent: '#ef6fa3', accentDim: '#c94d80', label: 'Pink' }
};

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

function getStoredAccent() {
  try {
    return localStorage.getItem(ACCENT_KEY) || 'mint';
  } catch {
    return 'mint';
  }
}

function resolveEffectiveTheme(mode) {
  if (mode === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return mode;
}

function applyTheme(mode) {
  document.documentElement.dataset.theme = resolveEffectiveTheme(mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // localStorage evtl. blockiert, Theme gilt dann nur für diese Sitzung
  }
}

function applyAccent(name) {
  const preset = ACCENT_PRESETS[name] || ACCENT_PRESETS.mint;
  document.documentElement.style.setProperty('--accent', preset.accent);
  document.documentElement.style.setProperty('--accent-dim', preset.accentDim);
  try {
    localStorage.setItem(ACCENT_KEY, name);
  } catch {
    // s.o.
  }
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (getStoredTheme() === 'system') applyTheme('system');
  });
}

applyTheme(getStoredTheme());
applyAccent(getStoredAccent());

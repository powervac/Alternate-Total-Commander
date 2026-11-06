'use strict';
// The external editor (Configuration > Editor): the program that F4 / Shift+F4 open. The built-in editor is the default; any text editor can be used instead
// (Notepad++, VS Code, Sublime, Notepad ...). Uses helpers from app.js (store, esc, msg) and filetools.js (ftForm).

const EDITOR_DEFAULTS = { mode: 'builtin', exe: '', args: '"%F"' };
const editorCfg = () => ({ ...EDITOR_DEFAULTS, ...(store.get('editorCfg', {}) || {}) });

/** the external editor for a local file: true when it was started */
async function openInExternalEditor(file) {
  const c = editorCfg();
  if (c.mode !== 'external' || !c.exe) return false;
  const r = await api.editorOpen({ exe: c.exe, args: c.args, file });
  if (r && r.error) { await msg('Editor', r.error + '\n\nCheck the program in Configuration > Editor.'); return true; }
  return true;
}

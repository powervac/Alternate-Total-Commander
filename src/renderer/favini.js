'use strict';
// The favorites bar as an .ini file (for example drivefavorites.ini): export, import, and writing the list by hand.
//
//   [Favorite1]
//   Label=UD                    (the text on the button; may be empty when there is an icon)
//   Name=User Documents         (the description in the tooltip)
//   Path=$HOME/Documents        (needed; ~, $NAME, ${NAME} and %NAME% are allowed)
//   Icon=documents              (a name of FAV_ICON_NAMES, or an own picture as data:image/png;base64,...)
//
// A folder of a cloud drive or a server also has ConnId, ConnType and ConnName. Pure functions: no page, no files (tests/favini.test.js).

const FAV_ICON_NAMES = ['folder', 'home', 'documents', 'downloads', 'pictures', 'music', 'video', 'desktop', 'drive', 'usb', 'network', 'server', 'cloud', 'code', 'game', 'star', 'temp', 'trash'];

/** an icon that may be kept: a built-in name, or a small picture of our own making (PNG data URL); anything else is dropped */
function favIconOk(icon) {
  const s = String(icon || '');
  if (FAV_ICON_NAMES.includes(s)) return s;
  return s.length <= 20000 && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(s) ? s : '';
}

const favIniValue = (v) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim();

function favIniWrite(list) {
  const out = ['; Alternate Commander favorites (drive and favorites bar)', ''];
  list.forEach((f, i) => {
    out.push(`[Favorite${i + 1}]`, `Label=${favIniValue(f.label)}`, `Name=${favIniValue(f.name)}`, `Path=${favIniValue(f.path)}`);
    const icon = favIconOk(f.icon);
    if (icon) out.push(`Icon=${icon}`);
    if (f.conn && f.conn.id) out.push(`ConnId=${favIniValue(f.conn.id)}`, `ConnType=${favIniValue(f.conn.type)}`, `ConnName=${favIniValue(f.conn.name)}`);
    out.push('');
  });
  return out.join('\r\n');
}

/** the favorites of an .ini text, in the order of the file; sections without a Path and sections that are not [Favorite...] are skipped */
function favIniParse(text) {
  const sections = [];
  let cur = null;
  for (const raw of String(text || '').replace(/^﻿/, '').split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    const head = /^\[(.*)\]$/.exec(line);
    if (head) {
      cur = /^favou?rite\s*\d*$/i.test(head[1].trim()) ? {} : null;
      if (cur) sections.push(cur);
      continue;
    }
    const eq = line.indexOf('=');
    if (!cur || eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    cur[line.slice(0, eq).trim().toLowerCase()] = value;
  }
  const out = [];
  for (const s of sections) {
    if (!s.path) continue;
    const f = { label: String(s.label || '').slice(0, 12), name: s.name || '', path: s.path };
    const icon = favIconOk(s.icon);
    if (icon) f.icon = icon;
    if (s.connid) f.conn = { id: s.connid, type: s.conntype || '', name: s.connname || '' };
    out.push(f);
  }
  return out;
}

/** add the imported ones to a list: an entry with the same folder (and connection) and label is not doubled */
function favIniMerge(list, add) {
  const key = (f) => JSON.stringify([f.conn ? f.conn.id : '', f.path, f.label]);
  const have = new Set(list.map(key));
  const fresh = add.filter((f) => !have.has(key(f)) && have.add(key(f)));
  return { list: [...list, ...fresh], added: fresh.length };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { FAV_ICON_NAMES, favIconOk, favIniWrite, favIniParse, favIniMerge };

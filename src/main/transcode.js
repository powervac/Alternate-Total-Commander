'use strict';
// Video/audio the built-in Chromium player cannot play (HEVC, AVI, WMV, FLV, AC3/DTS audio ...) are converted on the fly
// with the bundled ffmpeg into a fragmented MP4 (H.264 + AAC) that is streamed to the player through the local proxy.

const { spawn } = require('child_process');
const fs = require('fs');

let ffmpegPath = null;
try {
  ffmpegPath = require('ffmpeg-static');
  if (ffmpegPath) ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
} catch {
  ffmpegPath = null;
}

const children = new Set();
const available = () => !!ffmpegPath && fs.existsSync(ffmpegPath);

/** run `ffmpeg -i input` and read the stream information it prints on stderr */
function probe(input) {
  return new Promise((resolve, reject) => {
    if (!available()) return reject(new Error('ffmpeg is not installed. Run "npm install" in the Commander folder.'));
    const child = spawn(ffmpegPath, ['-hide_banner', '-nostdin', '-i', input], { windowsHide: true });
    children.add(child);
    let err = '';
    const timer = setTimeout(() => child.kill(), 25000);
    child.stderr.on('data', (d) => { err += d.toString('utf8'); if (err.length > 200000) child.kill(); });
    child.on('error', (e) => { clearTimeout(timer); children.delete(child); reject(e); });
    child.on('close', () => {
      clearTimeout(timer);
      children.delete(child);
      const info = parseInfo(err);
      if (!info.hasVideo && !info.hasAudio) return reject(new Error('ffmpeg cannot read this file' + (err ? ': ' + err.trim().split('\n').slice(-1)[0] : '')));
      resolve(info);
    });
  });
}

function parseInfo(err) {
  const info = { duration: 0, hasVideo: false, hasAudio: false, vcodec: '', pixOk: false, acodec: '', width: 0, height: 0 };
  const d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err);
  if (d) info.duration = +d[1] * 3600 + +d[2] * 60 + parseFloat(d[3]);
  // file level tags: the "Metadata:" block between "Input #0" and "Duration:" (stream tags are indented deeper)
  info.tags = {};
  // (Ogg/Vorbis keeps its tags on the stream, one level deeper: accept both, the first value wins)
  for (const m of err.matchAll(/^ {2,6}(title|artist|album|album_artist|date|genre)\s*:\s*(.+)$/gim)) {
    const k = m[1].toLowerCase();
    if (!info.tags[k]) info.tags[k] = m[2].trim();
  }
  for (const line of err.split(/\r?\n/)) {
    if (!info.hasVideo && /Stream #\d+:\d+.*: Video: /.test(line) && !/attached pic/.test(line)) {
      const m = /Video: (\w+)(.*)/.exec(line);
      info.hasVideo = true;
      info.vcodec = m[1];
      info.pixOk = /\byuvj?420p\b/.test(m[2]);
      const wh = /,\s*(\d{2,5})x(\d{2,5})/.exec(m[2]);
      if (wh) { info.width = +wh[1]; info.height = +wh[2]; }
    } else if (!info.hasAudio && /Stream #\d+:\d+.*: Audio: (\w+)/.test(line)) {
      info.hasAudio = true;
      info.acodec = /Audio: (\w+)/.exec(line)[1];
    }
  }
  return info;
}

/** ffmpeg arguments: copy what the player can already decode, convert the rest */
function buildArgs(input, info, start, audioOnly) {
  const a = ['-hide_banner', '-loglevel', 'error', '-nostdin'];
  if (start > 0) a.push('-ss', String(start));
  a.push('-i', input);
  if (audioOnly) {
    // music: always a lossless FLAC stream (APE, WavPack, ALAC, AIFF ... are decoded and re-packed without losing quality)
    a.push('-vn', '-map', '0:a:0', '-sn', '-dn', '-c:a', 'flac', '-f', 'flac', 'pipe:1');
    return a;
  }
  if (info.hasVideo) a.push('-map', '0:v:0');
  if (info.hasAudio) a.push('-map', '0:a:0');
  a.push('-sn', '-dn');
  if (info.hasVideo) {
    if (info.vcodec === 'h264' && info.pixOk) a.push('-c:v', 'copy');
    else a.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-vf', "scale='min(1920,iw)':-2");
  }
  if (info.hasAudio) {
    if (info.acodec === 'aac' || info.acodec === 'mp3') a.push('-c:a', 'copy');
    else a.push('-c:a', 'aac', '-b:a', '192k', '-ac', '2');
  }
  a.push('-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', 'pipe:1');
  return a;
}

/** start converting from `start` seconds; the caller pipes child.stdout somewhere and kills the child when done */
function start(input, info, startSec, audioOnly) {
  const child = spawn(ffmpegPath, buildArgs(input, info, startSec, audioOnly), { windowsHide: true });
  children.add(child);
  child.on('close', () => children.delete(child));
  child.on('error', () => children.delete(child));
  return child;
}

function killAll() {
  for (const c of children) {
    try { c.kill(); } catch { /* already gone */ }
  }
  children.clear();
}

module.exports = { available, probe, start, killAll, buildArgs };

// LHA -lh5- (8 KiB window) raw stream decoder + LHA level-0/1 container unwrapper
function lh5Decode(src, start, origSize) {
  let pos = start, bitBuf = 0, bitCnt = 0;
  const getBits = n => {
    let v = 0;
    while (n--) {
      if (!bitCnt) { bitBuf = pos < src.length ? src[pos++] : 0; bitCnt = 8; }
      v = (v << 1) | ((bitBuf >> --bitCnt) & 1);
    }
    return v;
  };
  // canonical Huffman decoder (as deflate): lengths -> counts/symbols
  const build = lens => {
    const cnt = new Array(17).fill(0), syms = [];
    for (const l of lens) cnt[l]++;
    cnt[0] = 0;
    const offs = new Array(18).fill(0);
    for (let l = 1; l < 17; l++) offs[l + 1] = offs[l] + cnt[l];
    for (let s = 0; s < lens.length; s++) if (lens[s]) syms[offs[lens[s]]++] = s;
    return { cnt, syms, single: -1 };
  };
  const decodeSym = h => {
    if (h.single >= 0) return h.single;
    let code = 0, first = 0, index = 0;
    for (let len = 1; len <= 16; len++) {
      code |= getBits(1);
      const c = h.cnt[len];
      if (code - c < first) return h.syms[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('LH5: ошибка кода Хаффмана');
  };
  const constTree = v => ({ cnt: [], syms: [], single: v });
  const NC = 510, NT = 19, NP = 14, THRESHOLD = 3;
  const out = new Uint8Array(origSize), WIN = 8192;
  let o = 0, blockSize = 0, cTree, pTree;
  const readPT = (nn, nbit, special) => {
    const n = getBits(nbit);
    if (n === 0) return constTree(getBits(nbit));
    const lens = new Array(nn).fill(0); let i = 0;
    while (i < n) {
      let c = getBits(3);
      if (c === 7) { while (getBits(1)) c++; }
      lens[i++] = c;
      if (i === special) { let k = getBits(2); while (k-- > 0) lens[i++] = 0; }
    }
    return build(lens);
  };
  const readC = ptTree => {
    const n = getBits(9);
    if (n === 0) return constTree(getBits(9));
    const lens = new Array(NC).fill(0); let i = 0;
    while (i < n) {
      const c = decodeSym(ptTree);
      if (c <= 2) {
        let k = c === 0 ? 1 : c === 1 ? getBits(4) + 3 : getBits(9) + 20;
        while (k-- > 0) lens[i++] = 0;
      } else lens[i++] = c - 2;
    }
    return build(lens);
  };
  while (o < origSize) {
    if (blockSize === 0) {
      blockSize = getBits(16);
      const ptTree = readPT(NT, 5, 3);
      cTree = readC(ptTree);
      pTree = readPT(NP, 4, -1);
    }
    blockSize--;
    const c = decodeSym(cTree);
    if (c < 256) out[o++] = c;
    else {
      const len = c - 256 + THRESHOLD;
      let j = decodeSym(pTree);
      if (j !== 0) j = (1 << (j - 1)) + getBits(j - 1);
      let from = o - j - 1;
      for (let k = 0; k < len && o < origSize; k++, from++) out[o++] = from >= 0 ? out[from] : 0;
    }
  }
  return out;
}

// returns unpacked bytes if `b` is an LHA archive (lh0/lh5), otherwise null
function lhaUnwrap(b) {
  if (b.length < 25 || b[2] !== 0x2d || b[3] !== 0x6c || b[4] !== 0x68 || b[6] !== 0x2d) return null;
  const method = b[5] - 48, hsz = b[0], packed = b[7] | (b[8] << 8) | (b[9] << 16) | (b[10] << 24), orig = b[11] | (b[12] << 8) | (b[13] << 16) | (b[14] << 24);
  const data = 2 + hsz;
  if (method === 0) return b.subarray(data, data + orig);
  if (method === 5) return lh5Decode(b, data, orig);
  throw new Error('LHA: метод -lh' + method + '- не поддерживается');
}

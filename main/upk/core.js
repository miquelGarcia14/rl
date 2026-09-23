'use strict';
/* Lector/escritor de paquetes .upk de Rocket League (Unreal Engine 3 "cooked").
   Puro Node: sin Python y sin binarios externos.

   Formato, de fuera a dentro:
     [0, nameOffset)                prefijo en claro (FileSummary + metadatos de compresion)
     [nameOffset, dependsOffset)    region CIFRADA (AES-256-ECB): tablas de nombres/imports/exports
                                    y, al final, la tabla de trozos comprimidos
     [totalHeaderSize, EOF)         trozos comprimidos con zlib (los datos de los objetos)

   Las claves AES NO se distribuyen con el panel: las pone el usuario (keys.txt, una clave
   en base64 por linea). Sin ese fichero este modulo no puede abrir nada, y se dice claramente. */
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');

const PACKAGE_FILE_TAG = 0x9e2a83c1;
const COMPRESS_ZLIB = 0x01; // UE3: ZLIB=0x01, LZO=0x02, LZX=0x04
const CHUNK_EXTRA_LICENSEE_MIN = 33; // parche del 12-08-2026: 12 bytes extra por trozo
const CHUNK_EXTRA_LEN = 12;
const BLOCK_SIZE = 0x20000;

const align16 = (n) => (n + 15) & ~15;
const chunkExtraLen = (lic) => ((lic || 0) >= CHUNK_EXTRA_LICENSEE_MIN ? CHUNK_EXTRA_LEN : 0);

/** Lector secuencial sobre un Buffer. */
class Reader {
  constructor(buf, pos = 0) { this.b = buf; this.pos = pos; }
  i32() { const v = this.b.readInt32LE(this.pos); this.pos += 4; return v; }
  u32() { const v = this.b.readUInt32LE(this.pos); this.pos += 4; return v; }
  u16() { const v = this.b.readUInt16LE(this.pos); this.pos += 2; return v; }
  i64() { const v = Number(this.b.readBigInt64LE(this.pos)); this.pos += 8; return v; }
  skip(n) { this.pos += n; }
  /** FString de UE3: longitud>0 => ANSI con nul final; <0 => UTF-16LE con nul final. */
  fstring() {
    const len = this.i32();
    if (len === 0) return '';
    if (len < 0) { const raw = this.b.slice(this.pos, this.pos - len * 2 - 2); this.pos += -len * 2; return raw.toString('utf16le'); }
    const raw = this.b.slice(this.pos, this.pos + len - 1); this.pos += len; return raw.toString('latin1');
  }
  array(fn) { const n = this.i32(); const out = []; for (let i = 0; i < n; i++) out.push(fn(this)); return out; }
}

/** Cabecera en claro. Devuelve tambien los offsets de los campos que hay que reparchear. */
function readSummary(buf) {
  const r = new Reader(buf);
  const tag = r.u32();
  if (tag !== PACKAGE_FILE_TAG) throw new Error('no es un paquete de Unreal Engine');
  const s = { tag };
  s.fileVersion = r.u16();
  s.licenseeVersion = r.u16();
  const off = { totalHeaderSize: r.pos };
  s.totalHeaderSize = r.i32();
  s.folderName = r.fstring();
  off.packageFlags = r.pos; s.packageFlags = r.u32();
  off.nameCount = r.pos; s.nameCount = r.i32();
  off.nameOffset = r.pos; s.nameOffset = r.i32();
  off.exportCount = r.pos; s.exportCount = r.i32();
  off.exportOffset = r.pos; s.exportOffset = r.i32();
  off.importCount = r.pos; s.importCount = r.i32();
  off.importOffset = r.pos; s.importOffset = r.i32();
  off.dependsOffset = r.pos; s.dependsOffset = r.i32();
  off.importExportGuidsOffset = r.pos; s.importExportGuidsOffset = r.i32();
  s.importGuidsCount = r.i32();
  s.exportGuidsCount = r.i32();
  off.thumbnailTableOffset = r.pos; s.thumbnailTableOffset = r.i32();
  r.skip(16); // guid
  off.generationsCount = r.pos;
  const genCount = r.i32();
  off.generationEntries = r.pos;
  off.generationCount = genCount;
  r.skip(genCount * 12);
  s.engineVersion = r.u32();
  s.cookerVersion = r.u32();
  off.compressionFlags = r.pos;
  s.compressionFlags = r.u32();
  r.array((rr) => { rr.skip(16); });               // compressed_chunks (32 bits, sin usar)
  r.i32();
  r.array((rr) => rr.fstring());
  r.array((rr) => { rr.skip(20); rr.array((r2) => r2.i32()); });
  s.metaOffset = r.pos;
  const meta = { garbageSizeOffset: r.pos, garbageSize: r.i32() };
  meta.compressedChunksOffsetOffset = r.pos; meta.compressedChunksOffset = r.i32();
  meta.lastBlockSizeOffset = r.pos; meta.lastBlockSize = r.i32();
  return { summary: s, meta, off };
}

// ---------------------------------------------------------------- claves

function loadKeys(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const keys = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => Buffer.from(l, 'base64'));
  const good = keys.filter((k) => k.length === 32);
  if (!good.length) throw new Error(`${file} no contiene ninguna clave AES-256 valida`);
  return good;
}

const ecb = (key, data, dec) => {
  const c = dec ? crypto.createDecipheriv('aes-256-ecb', key, null) : crypto.createCipheriv('aes-256-ecb', key, null);
  c.setAutoPadding(false);
  return Buffer.concat([c.update(data), c.final()]);
};
const decryptEcb = (key, data) => ecb(key, data, true);
const encryptEcb = (key, data) => ecb(key, data, false);

/** Una clave vale si al descifrar aparece la tabla de trozos donde toca. */
function keyWorks(summary, meta, key, encrypted) {
  const blockOffset = meta.compressedChunksOffset % 16;
  const blockStart = meta.compressedChunksOffset - blockOffset;
  const probe = encrypted.slice(blockStart, blockStart + 32);
  if (probe.length !== 32) return false;
  const view = decryptEcb(key, probe).slice(blockOffset);
  if (view.length < 8) return false;
  return view.readInt32LE(0) >= 1 && view.readInt32LE(4) === summary.dependsOffset;
}

/** Abre un .upk cifrado: devuelve cabecera descifrada, clave usada y tabla de trozos. */
function open(file, keys) {
  const buf = fs.readFileSync(file);
  const { summary, meta, off } = readSummary(buf);
  if ((summary.compressionFlags & COMPRESS_ZLIB) === 0) throw new Error('compresion no soportada');
  const size = align16(summary.totalHeaderSize - meta.garbageSize - summary.nameOffset);
  if (size < 0) throw new Error('cabecera corrupta o ya editada');
  const encrypted = buf.slice(summary.nameOffset, summary.nameOffset + size);
  if (encrypted.length !== size) throw new Error('fichero truncado');
  const key = keys.find((k) => keyWorks(summary, meta, k, encrypted));
  if (!key) throw new Error('ninguna clave de keys.txt sirve para este paquete');
  const plain = decryptEcb(key, encrypted);
  const chunks = readChunks(plain, meta.compressedChunksOffset, summary.licenseeVersion);
  if (!chunks.length || chunks[0].uncompressedOffset !== summary.dependsOffset) throw new Error('tabla de trozos invalida');
  return { file, buf, summary, meta, off, encrypted, plain, key, chunks };
}

// ---------------------------------------------------------------- trozos

function readChunks(plain, offset, licensee) {
  const extra = chunkExtraLen(licensee);
  const r = new Reader(plain, offset);
  const n = r.i32();
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = { uncompressedOffset: r.i64(), uncompressedSize: r.i32(), compressedOffset: r.i64(), compressedSize: r.i32() };
    c.extra = extra ? plain.slice(r.pos, r.pos + extra) : Buffer.alloc(0);
    r.skip(extra);
    out.push(c);
  }
  return out;
}

function writeChunks(chunks, licensee) {
  const extra = chunkExtraLen(licensee);
  const parts = [Buffer.alloc(4)];
  parts[0].writeInt32LE(chunks.length, 0);
  for (const c of chunks) {
    const b = Buffer.alloc(24 + extra);
    b.writeBigInt64LE(BigInt(c.uncompressedOffset), 0);
    b.writeInt32LE(c.uncompressedSize, 8);
    b.writeBigInt64LE(BigInt(c.compressedOffset), 12);
    b.writeInt32LE(c.compressedSize, 20);
    if (extra) (c.extra || Buffer.alloc(0)).copy(b, 24, 0, Math.min(extra, (c.extra || []).length || 0));
    parts.push(b);
  }
  return Buffer.concat(parts);
}

/** Descomprime un trozo: cabecera (tag, blockSize, totalComp, totalUncomp) + tabla de bloques + bloques. */
function inflateChunk(buf, offset, compressedSize) {
  const r = new Reader(buf, offset);
  if (r.u32() !== PACKAGE_FILE_TAG) throw new Error('trozo comprimido con tag invalido');
  r.i32();                                   // blockSize
  const totalComp = r.i32(); const totalUncomp = r.i32();
  const nBlocks = Math.ceil(totalUncomp / BLOCK_SIZE);
  const sizes = [];
  for (let i = 0; i < nBlocks; i++) sizes.push({ comp: r.i32(), uncomp: r.i32() });
  let p = r.pos;
  const out = [];
  for (const s of sizes) { out.push(zlib.inflateSync(buf.slice(p, p + s.comp))); p += s.comp; }
  const joined = Buffer.concat(out);
  if (joined.length !== totalUncomp) throw new Error(`descompresion inconsistente (${joined.length} != ${totalUncomp})`);
  if (p - offset > compressedSize) throw new Error('el trozo se sale de su tamano declarado');
  return joined;
}

function deflateChunk(data) {
  const blocks = [];
  for (let i = 0; i < data.length; i += BLOCK_SIZE) {
    const piece = data.slice(i, i + BLOCK_SIZE);
    blocks.push({ comp: zlib.deflateSync(piece, { level: 6 }), uncomp: piece.length });
  }
  const totalComp = blocks.reduce((s, b) => s + b.comp.length, 0);
  const head = Buffer.alloc(16 + blocks.length * 8);
  head.writeUInt32LE(PACKAGE_FILE_TAG, 0);
  head.writeInt32LE(BLOCK_SIZE, 4);
  head.writeInt32LE(totalComp, 8);
  head.writeInt32LE(data.length, 12);
  blocks.forEach((b, i) => { head.writeInt32LE(b.comp.length, 16 + i * 8); head.writeInt32LE(b.uncomp, 20 + i * 8); });
  return Buffer.concat([head, ...blocks.map((b) => b.comp)]);
}

/** Paquete completo en claro: prefijo + cabecera descifrada + datos descomprimidos en su sitio. */
function fullPlain(pkg) {
  const end = pkg.chunks[pkg.chunks.length - 1];
  const total = end.uncompressedOffset + end.uncompressedSize;
  const out = Buffer.alloc(total);
  pkg.buf.copy(out, 0, 0, pkg.summary.nameOffset);
  pkg.plain.copy(out, pkg.summary.nameOffset);
  for (const c of pkg.chunks) inflateChunk(pkg.buf, c.compressedOffset, c.compressedSize).copy(out, c.uncompressedOffset);
  return out;
}

// ---------------------------------------------------------------- tabla de nombres

/** Posiciones de cada entrada de la tabla de nombres, relativas al buffer en claro `plain`. */
function nameSpans(pkg) {
  const base = pkg.summary.nameOffset;
  let pos = 0; // relativo a plain
  const spans = [];
  for (let i = 0; i < pkg.summary.nameCount; i++) {
    const start = pos;
    const len = pkg.plain.readInt32LE(pos); pos += 4;
    let text;
    if (len > 0) { text = pkg.plain.slice(pos, pos + len - 1).toString('latin1'); pos += len; }
    else if (len < 0) { text = pkg.plain.slice(pos, pos - len * 2 - 2).toString('utf16le'); pos += -len * 2; }
    else text = '';
    text = text.split(' ')[0]; // los renombrados en sitio dejan relleno de nulos detras
    const flagsOffset = pos; pos += 8;
    spans.push({ index: i, start, end: pos, len, flagsOffset, text, absStart: base + start });
  }
  return spans;
}

/** Reescribe un nombre SIN mover nada: el hueco original se rellena con ceros. */
function renameInPlace(pkg, spans, index, newText) {
  const sp = spans[index];
  let payload;
  if (sp.len > 0) {
    const raw = Buffer.from(newText, 'latin1');
    if (raw.length + 1 > sp.len) return false;                      // no cabe: no se toca
    payload = Buffer.alloc(4 + sp.len);
    payload.writeInt32LE(sp.len, 0);
    raw.copy(payload, 4);
  } else if (sp.len < 0) {
    const chars = -sp.len;
    if (newText.length + 1 > chars) return false;
    payload = Buffer.alloc(4 + chars * 2);
    payload.writeInt32LE(sp.len, 0);
    Buffer.from(newText, 'utf16le').copy(payload, 4);
  } else return false;
  payload.copy(pkg.plain, sp.start);
  sp.text = newText;
  return true;
}

module.exports = {
  PACKAGE_FILE_TAG, BLOCK_SIZE, align16, chunkExtraLen,
  Reader, readSummary, loadKeys, decryptEcb, encryptEcb, keyWorks,
  open, readChunks, writeChunks, inflateChunk, deflateChunk, fullPlain,
  nameSpans, renameInPlace,
};

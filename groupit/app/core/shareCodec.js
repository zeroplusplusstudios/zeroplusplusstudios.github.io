import { BrowserTooOldError, FormatError, NewerBoardError, Puzzle } from './puzzle.js';
export { BrowserTooOldError };
export const HeadBase = 'https://zeroplusplusstudios.github.io/groupit/b/#';
export const Version = '1';
export const Head = HeadBase + Version;
export const LegacyHead = 'groupit://b/1';
const MaxPayloadChars = 4096;
const MaxLineBytes = 64 * 1024;
export const KnownVersions = [Version];
const LegacyScheme = 'groupit://b/';
const NewerShape = /^[2-9][A-Za-z0-9_-]{15,}$/;
function queryValue(t) {
    for (let q = t.indexOf('?'); q >= 0; q = t.indexOf('?', q + 1)) {
        const params = t.slice(q + 1).split(/\s/)[0];
        for (const param of params.split('&')) {
            if (param.length >= 2 && param.startsWith('b='))
                return param.slice(2);
        }
    }
    return null;
}
function tailOf(text) {
    if (text === null || text === undefined)
        return null;
    const t = text.trim();
    if (t.length === 0)
        return null;
    if (t.toLowerCase().startsWith(LegacyScheme))
        return t.slice(LegacyScheme.length).trim();
    const hash = t.indexOf('#');
    if (hash >= 0)
        return t.slice(hash + 1).trim();
    const query = queryValue(t);
    if (query !== null)
        return query;
    const encoded = t.indexOf('%23');
    return encoded < 0 ? null : t.slice(encoded + 3).trim();
}
export function normaliseLink(text) {
    const t = tailOf(text);
    if (t === null || t.length < 2 || !KnownVersions.includes(t[0]))
        return null;
    return HeadBase + t;
}
export function classifyLink(text) {
    if (normaliseLink(text) !== null)
        return 'board';
    const t = tailOf(text);
    return t !== null && NewerShape.test(t) ? 'newer' : 'notOurs';
}
export function looksLikeLink(url) {
    return normaliseLink(url) !== null;
}
function payloadOf(url) {
    const canonical = normaliseLink(url);
    if (canonical === null)
        throw new FormatError('not a GroupIt board link');
    return canonical.slice(Head.length).trim();
}
export function canDecodeLinks() {
    try {
        new DecompressionStream('deflate-raw');
        return true;
    }
    catch {
        return false;
    }
}
function armour(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function dearmour(payload) {
    if (!/^[A-Za-z0-9_-]+$/.test(payload))
        throw new FormatError('board link payload is not base64url');
    let b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    switch (b64.length % 4) {
        case 2:
            b64 += '==';
            break;
        case 3:
            b64 += '=';
            break;
        case 1: throw new FormatError('board link payload has an impossible length');
        default: break;
    }
    let binary;
    try {
        binary = atob(b64);
    }
    catch {
        throw new FormatError('board link payload is not base64url');
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
        bytes[i] = binary.charCodeAt(i);
    return bytes;
}
async function through(stream, input, cap) {
    const writer = stream.writable.getWriter();
    const written = writer.write(input).then(() => writer.close()).catch(() => { });
    const reader = stream.readable.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        total += value.length;
        if (total > cap)
            throw new FormatError('board link inflates past any real board');
        chunks.push(value);
    }
    await written;
    const out = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) {
        out.set(c, at);
        at += c.length;
    }
    return out;
}
export async function link(puzzle) {
    if (puzzle === null || puzzle === undefined)
        throw new Error('puzzle is required');
    const bare = new Puzzle({
        rows: puzzle.rows, cols: puzzle.cols, clues: puzzle.clues, solution: null,
        difficulty: puzzle.difficulty, id: null, chapter: 0, title: null,
        mechanic: puzzle.mechanic, walls: puzzle.walls, groups: puzzle.groups,
        pairs: puzzle.pairs, voids: puzzle.voids,
    });
    const raw = new TextEncoder().encode(bare.toLine());
    const packed = await through(new CompressionStream('deflate-raw'), raw, MaxLineBytes);
    return Head + armour(packed);
}
export async function fromLink(url) {
    if (normaliseLink(url) === null) {
        if (classifyLink(url) === 'newer')
            throw new NewerBoardError('board link is a newer version than this build reads');
        throw new FormatError('not a GroupIt board link');
    }
    const payload = payloadOf(url);
    if (payload.length === 0 || payload.length > MaxPayloadChars)
        throw new FormatError('board link payload has an impossible length');
    const packed = dearmour(payload);
    if (!canDecodeLinks())
        throw new BrowserTooOldError();
    let inflated;
    try {
        inflated = await through(new DecompressionStream('deflate-raw'), packed, MaxLineBytes);
    }
    catch (e) {
        if (e instanceof FormatError)
            throw e;
        throw new FormatError('board link payload is not deflate data', { cause: e });
    }
    try {
        return Puzzle.fromLine(new TextDecoder().decode(inflated));
    }
    catch (e) {
        if (e instanceof FormatError)
            throw e;
        throw new FormatError('board link decoded to an impossible board', { cause: e });
    }
}

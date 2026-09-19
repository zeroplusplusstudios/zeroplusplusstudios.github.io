// Ported from Assets/_Project/Scripts/Core/Content/ShareCodec.cs
//
// A board as a link. The whole board travels in the link — never a reference to one. The pools
// re-bake, codes are appended, walks reshuffle: any id-shaped link would rot the day the content
// moved, and could never carry a board a future build has not baked. So the payload is the
// board's own toLine — the ls8 codec that already round-trips every board this game has ever
// shipped — deflated and base64url-armoured. No server, no account, no database.
//
// ONE DELIBERATE DIFFERENCE FROM THE C#, forced, and it does not affect the wire format. (There
// were two: the head used to be https here and `groupit://` there. The C# moved to the same https
// head on 2026-09-19 — a link nobody without the app can open is not a share — so the only
// divergence left is the one below, and `looksLikeLink` accepts the retired scheme on both sides.)
//
// 1. THESE FUNCTIONS ARE ASYNC. .NET's DeflateStream is synchronous; the browser's only built-in
//    deflate is CompressionStream, which is a stream. Bundling a synchronous inflate purely to
//    keep the signature would add a dependency and a second implementation of a thing every
//    browser already ships. Decoding happens once on page load, so the await costs nothing.
//
// Not encrypted, deliberately — the same call the C# makes. Nothing in a board is secret: the
// solution is stripped before encoding and the receiver re-derives everything it trusts.
import { FormatError, Puzzle } from './puzzle.js';
/**
 * Everything before the version digit — the `#` included.
 *
 * The payload is a FRAGMENT, and that is what makes the link work at all. GitHub Pages serves
 * static files with no rewrite rule, so `/groupit/b/1AbCd` is a 404; `/groupit/b/#1AbCd` is a
 * request for `/groupit/b/`, which is a real page, with the board handed to the script instead of
 * to the server. It never reaches an access log either. Both app-link schemes match on the path
 * and pass the whole URI through, so the installed app still intercepts it.
 */
export const HeadBase = 'https://zeroplusplusstudios.github.io/groupit/b/#';
/** The version digit the current payload format wears. Bump when the format changes shape. */
export const Version = '1';
/** The link head, version included. */
export const Head = HeadBase + Version;
/**
 * The scheme the installed app already emits and registers an intent-filter for. Accepted by
 * `looksLikeLink` and `fromLink` so a link sent before the website existed still opens.
 */
export const LegacyHead = 'groupit://b/1';
/**
 * Ceilings against garbage and zip bombs: no real board's line approaches either (the largest
 * shipped board deflates to ~200 bytes).
 */
const MaxPayloadChars = 4096;
const MaxLineBytes = 64 * 1024;
/** Cheap gate for "is this even ours" — scheme and version, nothing else. */
export function looksLikeLink(url) {
    if (url === null || url === undefined || url.length === 0)
        return false;
    return url.startsWith(Head) || url.startsWith(LegacyHead);
}
function payloadOf(url) {
    if (url.startsWith(Head))
        return url.slice(Head.length).trim();
    if (url.startsWith(LegacyHead))
        return url.slice(LegacyHead.length).trim();
    throw new FormatError('not a GroupIt board link');
}
// base64url — the alphabet that survives every chat app unescaped: A–Z a–z 0–9 - _
function armour(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function dearmour(payload) {
    // Reject before decoding rather than letting atob guess: an unexpected character in a link is
    // corruption or tampering, and both must land on FormatError like every other refusal.
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
// The buffer parameter is spelled out because TypeScript 5.7 made Uint8Array generic over its
// backing buffer, and a plain `Uint8Array` therefore includes SharedArrayBuffer-backed views,
// which the stream APIs will not take. Every caller here allocates its own ArrayBuffer.
async function through(stream, input, cap) {
    const writer = stream.writable.getWriter();
    // Not awaited before the reads start: writable and readable are two ends of one pipe, and a
    // payload larger than the internal buffer deadlocks if you wait for the write to drain before
    // draining the output.
    //
    // The trailing catch is not decoration. When inflate rejects garbage, BOTH ends reject — and
    // the reader's rejection is the one that escapes this function, so without a handler here the
    // writer's becomes an unhandled promise rejection. In Node that kills the process; in a
    // browser it is an uncaught error on the page for every malformed link a stranger is sent.
    // The reader is the single source of truth for what went wrong, so this one is swallowed.
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
/**
 * The link for a board.
 *
 * Identity is stripped: an id names a board in a SAVE file, and this board is nobody's save.
 * Solution stripped too — the receiver proves the board out anyway, and a link should not carry
 * the answer to the puzzle it is.
 *
 * The bytes are NOT guaranteed identical to the C#'s for the same board: `deflate-raw` in a
 * browser and .NET's CompressionLevel.Optimal are both valid deflate and pick different
 * encodings. Both decode to the same line, which is the property that matters and the one
 * test/links.ts asserts in each direction.
 */
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
/**
 * The board in a link. Throws FormatError on anything that is not a well-formed version-1 board
 * link — corruption and cleverness both land there, which is what lets a caller have exactly one
 * thing to catch.
 */
export async function fromLink(url) {
    if (!looksLikeLink(url))
        throw new FormatError('not a GroupIt board link');
    const payload = payloadOf(url);
    if (payload.length === 0 || payload.length > MaxPayloadChars)
        throw new FormatError('board link payload has an impossible length');
    const packed = dearmour(payload);
    let inflated;
    try {
        inflated = await through(new DecompressionStream('deflate-raw'), packed, MaxLineBytes);
    }
    catch (e) {
        // The cap above already throws FormatError; everything else here is malformed deflate,
        // which to a receiver is the same single fact.
        if (e instanceof FormatError)
            throw e;
        throw new FormatError('board link payload is not deflate data', { cause: e });
    }
    // fromLine throws FormatError on unknown tokens — but a bent payload can also inflate to a
    // line whose FIELDS parse and whose VALUES are impossible, which the Puzzle constructor
    // rejects as a plain Error instead. To a receiver they are the same fact.
    try {
        return Puzzle.fromLine(new TextDecoder().decode(inflated));
    }
    catch (e) {
        if (e instanceof FormatError)
            throw e;
        throw new FormatError('board link decoded to an impossible board', { cause: e });
    }
}
//# sourceMappingURL=shareCodec.js.map
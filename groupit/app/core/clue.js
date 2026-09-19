// Ported from Assets/_Project/Scripts/Core/Model/Clue.cs
//
// The C# is a readonly struct; here it is a frozen object built only through the factories,
// which is the same guarantee by a different route. Field names match the C# exactly.
import { ClueKind, Dir, Tone } from './types.js';
function make(kind, row, col, tone, dir, value) {
    return Object.freeze({ kind, row, col, tone, dir, value });
}
export const Clues = {
    region: (row, col, tone, size) => make(ClueKind.Region, row, col, tone, Dir.Right, size),
    line: (row, col, dir, segments) => make(ClueKind.Line, row, col, Tone.Shadow, dir, segments),
    lantern: (row, col, tone, seen) => make(ClueKind.Lantern, row, col, tone, Dir.Right, seen),
    rowTally: (row, count) => make(ClueKind.Tally, row, -1, Tone.Light, Dir.Right, count),
    colTally: (col, count) => make(ClueKind.Tally, -1, col, Tone.Light, Dir.Right, count),
    open: (row, col, size) => make(ClueKind.Open, row, col, Tone.Shadow, Dir.Right, size),
    rowTurns: (row, runs) => make(ClueKind.Turns, row, -1, Tone.Shadow, Dir.Right, runs),
    colTurns: (col, runs) => make(ClueKind.Turns, -1, col, Tone.Shadow, Dir.Right, runs),
    watch: (row, col, litNeighbours) => make(ClueKind.Watch, row, col, Tone.Shadow, Dir.Right, litNeighbours),
    knight: (row, col, tone, seen) => make(ClueKind.Knight, row, col, tone, Dir.Right, seen),
    cross: (row, col, tone, total) => make(ClueKind.Cross, row, col, tone, Dir.Right, total),
    /**
     * A crest reading its own row (Right) or its own column (Down). The other two directions are
     * refused rather than quietly folded onto an axis: lineRange's default arm means Down, so a
     * stray Left would read as a column clue with nothing thrown.
     */
    crest: (row, col, tone, dir, largest) => {
        if (dir !== Dir.Right && dir !== Dir.Down)
            throw new RangeError('a crest reads Right or Down');
        return make(ClueKind.Crest, row, col, tone, dir, largest);
    },
    twin: (row, col, letterIndex) => make(ClueKind.Twin, row, col, Tone.Shadow, Dir.Right, letterIndex),
    shore: (row, col, tone, perimeter) => make(ClueKind.Shore, row, col, tone, Dir.Right, perimeter),
    double: (row, col, dir, size) => make(ClueKind.Double, row, col, Tone.Shadow, dir, size),
};
/**
 * True for the kinds that state their OWN cell's tone, so the cell arrives committed and the
 * player may not edit it.
 */
export function locksItsCell(c) {
    return c.kind === ClueKind.Region || c.kind === ClueKind.Lantern || c.kind === ClueKind.Knight ||
        c.kind === ClueKind.Cross || c.kind === ClueKind.Crest || c.kind === ClueKind.Shore;
}
/**
 * True for every kind whose value is the size of the patch its own cell sits in.
 *
 * NOT the same list as locksItsCell and must never be folded into it — Open and Double leave
 * their own cell for the player to mark; Lantern, Knight, Cross, Crest and Shore lock a cell
 * and say nothing about patch SIZE. The two overlap on Region alone.
 */
export function namesItsPatchSize(c) {
    return c.kind === ClueKind.Region || c.kind === ClueKind.Open || c.kind === ClueKind.Double;
}
/**
 * True for the two kinds that live in the gutter rather than on a cell. Both use the
 * row/col === -1 convention, and every loop that maps a clue onto the grid has to skip both:
 * `clue.row * cols + clue.col` on one of these is a plausible-looking index into somebody
 * else's cell.
 */
export function isMargin(c) {
    return c.kind === ClueKind.Tally || c.kind === ClueKind.Turns;
}
/** The flat cell index this clue is PRINTED on, or -1 for a clue printed in the gutter. */
export function cellIndex(c, cols) {
    return isMargin(c) ? -1 : c.row * cols + c.col;
}
/**
 * The number the clue PRINTS on the board. A line or turnstile clue prints one less than its
 * value, because the board asks how many times the colour CHANGES rather than how many bands
 * it crosses.
 *
 * This is a display transform and nothing else. Nothing may ever compare, solve or bake
 * against it — the moment a rule reads this instead of `value`, a board baked before means
 * something different from one baked after.
 */
export function printed(c) {
    return c.kind === ClueKind.Line || c.kind === ClueKind.Turns ? c.value - 1 : c.value;
}
/** The twin alphabet, I and O removed (at clue size I/l collide and O is a zero). */
export function letterFor(index) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    if (index < 0)
        return '?';
    return index < alphabet.length
        ? alphabet[index]
        : alphabet[index % alphabet.length] + "'".repeat(Math.floor(index / alphabet.length));
}
/**
 * What the board actually PRINTS, as text. Every site that renders or narrates a clue comes
 * through here. A twin carries an equals sign because a bare letter is a NAME and a name
 * asserts nothing — `=A` asserts the thing the mechanic is.
 */
export function label(c) {
    return c.kind === ClueKind.Twin ? '=' + letterFor(c.value) : String(printed(c));
}
/**
 * Value equality. The payload beyond position+value differs per kind: Region and Lantern
 * carry a tone, Line a direction, Tally and Open nothing at all — their unused fields are
 * factory-stuffed constants and must not decide equality.
 */
export function clueEquals(a, b) {
    if (a.kind !== b.kind || a.row !== b.row || a.col !== b.col || a.value !== b.value)
        return false;
    switch (a.kind) {
        case ClueKind.Region:
        case ClueKind.Lantern:
        case ClueKind.Knight:
        case ClueKind.Cross:
        case ClueKind.Shore:
            return a.tone === b.tone;
        case ClueKind.Crest:
            return a.tone === b.tone && a.dir === b.dir;
        case ClueKind.Line:
        case ClueKind.Double:
            return a.dir === b.dir;
        default:
            return true;
    }
}
//# sourceMappingURL=clue.js.map
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
    crest: (row, col, tone, dir, largest) => {
        if (dir !== Dir.Right && dir !== Dir.Down)
            throw new RangeError('a crest reads Right or Down');
        return make(ClueKind.Crest, row, col, tone, dir, largest);
    },
    twin: (row, col, letterIndex) => make(ClueKind.Twin, row, col, Tone.Shadow, Dir.Right, letterIndex),
    shore: (row, col, tone, perimeter) => make(ClueKind.Shore, row, col, tone, Dir.Right, perimeter),
    double: (row, col, dir, size) => make(ClueKind.Double, row, col, Tone.Shadow, dir, size),
};
export function locksItsCell(c) {
    return c.kind === ClueKind.Region || c.kind === ClueKind.Lantern || c.kind === ClueKind.Knight ||
        c.kind === ClueKind.Cross || c.kind === ClueKind.Crest || c.kind === ClueKind.Shore;
}
export function namesItsPatchSize(c) {
    return c.kind === ClueKind.Region || c.kind === ClueKind.Open || c.kind === ClueKind.Double;
}
export function isMargin(c) {
    return c.kind === ClueKind.Tally || c.kind === ClueKind.Turns;
}
export function cellIndex(c, cols) {
    return isMargin(c) ? -1 : c.row * cols + c.col;
}
export function printed(c) {
    return c.kind === ClueKind.Line || c.kind === ClueKind.Turns ? c.value - 1 : c.value;
}
export function letterFor(index) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    if (index < 0)
        return '?';
    return index < alphabet.length
        ? alphabet[index]
        : alphabet[index % alphabet.length] + "'".repeat(Math.floor(index / alphabet.length));
}
export function label(c) {
    return c.kind === ClueKind.Twin ? '=' + letterFor(c.value) : String(printed(c));
}
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

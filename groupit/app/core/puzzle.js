// Ported from Assets/_Project/Scripts/Core/Model/Puzzle.cs
//
// THE LINE CODEC MUST STAY BYTE-EXACT WITH THE C#. Every board in the pack and every board in
// a share link is one of these lines; a single character of drift and the app and the web
// disagree about a board that is already in somebody's chat history. `test/differential.ts`
// round-trips all 7,305 baked lines through here and asserts the output is identical input.
import { Clues } from './clue.js';
import { Mechanic, MaxMechanic } from './mechanic.js';
import * as Regions from './regions.js';
import { ClueKind, Dir, Tone } from './types.js';
const ShadowChar = '#';
const LightChar = '.';
const GoldChar = '*';
function dirChar(d) {
    return d === Dir.Right ? 'r' : d === Dir.Left ? 'l' : d === Dir.Up ? 'u' : 'd';
}
function parseDir(c) {
    switch (c) {
        case 'r': return Dir.Right;
        case 'l': return Dir.Left;
        case 'u': return Dir.Up;
        case 'd': return Dir.Down;
        default: throw new FormatError(`bad direction '${c}'`);
    }
}
function toneChar(t) {
    return t === Tone.Shadow ? 'S' : t === Tone.Light ? 'L' : 'G';
}
function parseTone(s) {
    switch (s) {
        case 'S': return Tone.Shadow;
        case 'L': return Tone.Light;
        case 'G': return Tone.Gold;
        default: throw new FormatError(`bad tone '${s}'`);
    }
}
/**
 * The single error every malformed board produces, matching C#'s FormatException. `FromLink`
 * and the pack reader both funnel into it so a caller has exactly one thing to catch — the C#
 * ShareCodec makes the same promise for the same reason.
 */
export class FormatError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = 'FormatError';
    }
}
/** Integer parse that refuses everything C#'s int.Parse(InvariantCulture) refuses. */
function parseInt32(s, what) {
    // Number() would accept '', '0x10', '1e3', ' 12 ' and Infinity, every one of which C#
    // throws on. The pack is machine-written, but a share link is attacker-supplied.
    if (!/^-?\d+$/.test(s))
        throw new FormatError(`bad ${what} '${s}'`);
    const n = Number(s);
    if (!Number.isSafeInteger(n))
        throw new FormatError(`${what} out of range '${s}'`);
    return n;
}
/**
 * One board: its size, its printed clues, its rule twist (mechanic plus any structure the
 * twist needs), and (for verification and hints) the unique solution the generator proved.
 * Immutable.
 */
export class Puzzle {
    rows;
    cols;
    clues;
    /** Row-major, length rows*cols, values are Tone. May be null. */
    solution;
    difficulty;
    /** Stable identity, e.g. `c3-05`. Progress is keyed on THIS, never on a pack index. */
    id;
    chapter;
    /** What the solved board depicts, for picture boards. Null on an ordinary board. */
    title;
    /** The one rule twist this board carries — exactly one, mechanics never compose. */
    mechanic;
    /** Flattened cell-index pairs whose shared edge is cut. Null when there are none. */
    walls;
    /** Disjoint sets of cell indices that must share one tone and flip together. */
    groups;
    /** Ordered cell pairs — flattened (tail, head, …) — whose MEANING is the board's mechanic. */
    pairs;
    /** Cells that are not part of the board — flat indices, ascending. Well boards only. */
    voids;
    // Both built lazily, for the reason the C# builds them lazily: the arrays are the canonical
    // serialised form and these exist only so an inner-loop test is O(1).
    #voidMask;
    #wallSet;
    constructor(init) {
        const { rows, cols } = init;
        if (rows <= 0 || cols <= 0)
            throw new RangeError('rows and cols must be positive');
        const solution = init.solution ?? null;
        if (solution !== null && solution.length !== rows * cols)
            throw new Error('solution length must be rows*cols');
        const id = init.id ?? null;
        const title = init.title ?? null;
        if (id !== null && id.indexOf(' ') >= 0)
            throw new Error('id must not contain spaces — the pack format is space-separated');
        if (title !== null && title.indexOf(' ') >= 0)
            throw new Error('title must not contain spaces — the pack format is space-separated');
        const walls = init.walls ?? null;
        const pairs = init.pairs ?? null;
        if (walls !== null && (walls.length & 1) !== 0)
            throw new Error('walls must be flattened cell-index pairs');
        if (pairs !== null && (pairs.length & 1) !== 0)
            throw new Error('pairs must be flattened cell-index pairs');
        this.rows = rows;
        this.cols = cols;
        this.clues = Object.freeze((init.clues ?? []).slice());
        this.solution = solution;
        this.difficulty = init.difficulty ?? 0;
        this.id = id;
        this.chapter = init.chapter ?? 0;
        this.title = title === null || title.length === 0 ? null : title;
        this.mechanic = init.mechanic ?? Mechanic.None;
        // Empty means the same as absent; normalise so "has walls" is one null check.
        const groups = init.groups ?? null;
        const voids = init.voids ?? null;
        this.walls = walls !== null && walls.length > 0 ? Int32Array.from(walls) : null;
        this.groups = groups !== null && groups.length > 0 ? groups : null;
        this.pairs = pairs !== null && pairs.length > 0 ? Int32Array.from(pairs) : null;
        this.voids = voids !== null && voids.length > 0 ? Int32Array.from(voids) : null;
        Object.freeze(this);
    }
    get isPicture() { return this.title !== null && this.title.length > 0; }
    get cellCount() { return this.rows * this.cols; }
    /** True when column 0 and column cols-1 are orthogonally adjacent — the whole of Seam. */
    get wraps() { return this.mechanic === Mechanic.Seam; }
    /** Cells a player can actually mark — the whole board, less any voids. */
    get playableCells() { return this.cellCount - (this.voids?.length ?? 0); }
    /** The void mask, or null when the board is a full rectangle. */
    get voidMask() {
        if (this.voids === null)
            return null;
        if (this.#voidMask === undefined) {
            const mask = new Uint8Array(this.cellCount);
            for (const cell of this.voids)
                if (cell >= 0 && cell < mask.length)
                    mask[cell] = 1;
            this.#voidMask = mask;
        }
        return this.#voidMask;
    }
    /** True when this cell is a hole rather than a square. False on every other board. */
    isVoid(cell) {
        const mask = this.voidMask;
        return mask !== null && cell >= 0 && cell < mask.length && mask[cell] !== 0;
    }
    /** True when the shared edge between two adjacent cells is cut. Order-insensitive. */
    walled(a, b) {
        if (this.walls === null)
            return false;
        if (this.#wallSet === undefined)
            this.#wallSet = Regions.buildWallSet(this.walls);
        return this.#wallSet !== null && this.#wallSet.has(Regions.wallKey(a, b));
    }
    /**
     * The cell adjacent to `cell` in direction `d`, or -1 when the step leaves the board, lands
     * in a void, or crosses a wall. The one place a caller holding a Puzzle should ever ask what
     * "next to" means.
     */
    neighbour(cell, d) {
        const ni = Regions.step(cell, d, this.rows, this.cols, this.wraps, this.voidMask);
        if (ni < 0 || this.walled(cell, ni))
            return -1;
        return ni;
    }
    /** The same board, labelled. */
    withIdentity(id, chapter, title = null) {
        return new Puzzle({
            rows: this.rows, cols: this.cols, clues: this.clues, solution: this.solution,
            difficulty: this.difficulty, id, chapter, title: title ?? this.title,
            mechanic: this.mechanic, walls: this.walls, groups: this.groups,
            pairs: this.pairs, voids: this.voids,
        });
    }
    clueAt(row, col) {
        for (const c of this.clues)
            if (c.row === row && c.col === col)
                return c;
        return null;
    }
    // ───────────────────────────────────────────────────────────────── text format
    // One puzzle per line, space-separated fields:
    //
    //   <rows> <cols> <difficulty> <id|-> <chapter> <title|-> <solution|-> <token> <token> ...
    //
    // token : M,<mechanic>            mechanic id (omitted when None)
    //         W,r1,c1,r2,c2           wall between two adjacent cells
    //         G,i,j,k,...             gas-line group, flat cell indices (>= 2 of them)
    //         R,row,col,S|L|G,size    region clue, tone given
    //         L,row,col,r|l|u|d,segs  line clue, tone withheld
    //         N,row,col,S|L|G,seen    lantern clue, tone given
    //         T,row,col,L,count       tally clue; row or col is -1 (the off-grid axis)
    //         U,row,col,-,size        open clue, tone withheld
    //         X,row,col,-,runs        turnstile clue; row or col is -1, same as T
    //         P,r1,c1,r2,c2           ordered cell pair — weir tail->head or chevron heavy->light
    //         V,row,col               a void cell: a hole in the board (Well only)
    //         C,row,col,-,lit         watch clue, tone withheld
    //         K,row,col,S|L|G,seen    knight clue, tone given
    //         Y,row,col,S|L|G,total   crossroads clue, tone given
    //         E,row,col,<tone><dir>,n crest clue — the one payload field carrying both
    //         Q,row,col,-,letter      twin clue; the value is a letter INDEX
    //         F,row,col,S|L|G,fence   shoreline clue, tone given
    //         D,row,col,r|l|u|d,size  twice-told clue, tone withheld
    //
    // Parsing is strict in both directions: an unknown solution char, tone letter or token
    // prefix throws rather than being silently misread as Light.
    toLine() {
        const parts = [];
        let head = `${this.rows} ${this.cols} ${this.difficulty} ` +
            `${this.id === null || this.id.length === 0 ? '-' : this.id} ${this.chapter} ` +
            `${this.title === null || this.title.length === 0 ? '-' : this.title} `;
        if (this.solution === null) {
            head += '-';
        }
        else {
            let s = '';
            for (let i = 0; i < this.solution.length; i++) {
                s += this.solution[i] === Tone.Shadow ? ShadowChar
                    : this.solution[i] === Tone.Light ? LightChar : GoldChar;
            }
            head += s;
        }
        parts.push(head);
        // Structure before clues: M, then W, then G. Fixed order keeps the bake diffable.
        if (this.mechanic !== Mechanic.None)
            parts.push(`M,${this.mechanic}`);
        if (this.walls !== null) {
            for (let i = 0; i < this.walls.length; i += 2) {
                const a = this.walls[i], b = this.walls[i + 1];
                parts.push(`W,${Math.floor(a / this.cols)},${a % this.cols},` +
                    `${Math.floor(b / this.cols)},${b % this.cols}`);
            }
        }
        if (this.groups !== null) {
            for (const g of this.groups)
                parts.push('G,' + g.join(','));
        }
        if (this.pairs !== null) {
            for (let i = 0; i < this.pairs.length; i += 2) {
                const a = this.pairs[i], b = this.pairs[i + 1];
                parts.push(`P,${Math.floor(a / this.cols)},${a % this.cols},` +
                    `${Math.floor(b / this.cols)},${b % this.cols}`);
            }
        }
        if (this.voids !== null) {
            for (const cell of this.voids) {
                parts.push(`V,${Math.floor(cell / this.cols)},${cell % this.cols}`);
            }
        }
        for (const c of this.clues) {
            switch (c.kind) {
                case ClueKind.Region:
                    parts.push(`R,${c.row},${c.col},${toneChar(c.tone)},${c.value}`);
                    break;
                case ClueKind.Lantern:
                    parts.push(`N,${c.row},${c.col},${toneChar(c.tone)},${c.value}`);
                    break;
                case ClueKind.Tally:
                    parts.push(`T,${c.row},${c.col},L,${c.value}`);
                    break;
                case ClueKind.Open:
                    parts.push(`U,${c.row},${c.col},-,${c.value}`);
                    break;
                case ClueKind.Turns:
                    parts.push(`X,${c.row},${c.col},-,${c.value}`);
                    break;
                case ClueKind.Watch:
                    parts.push(`C,${c.row},${c.col},-,${c.value}`);
                    break;
                case ClueKind.Knight:
                    parts.push(`K,${c.row},${c.col},${toneChar(c.tone)},${c.value}`);
                    break;
                case ClueKind.Cross:
                    parts.push(`Y,${c.row},${c.col},${toneChar(c.tone)},${c.value}`);
                    break;
                case ClueKind.Crest:
                    // The one clue carrying BOTH a tone and a direction, so its payload field is two
                    // characters. Widening the field for everybody would rewrite every shipped line to
                    // say the same thing it already says.
                    parts.push(`E,${c.row},${c.col},${toneChar(c.tone)}${dirChar(c.dir)},${c.value}`);
                    break;
                case ClueKind.Twin:
                    parts.push(`Q,${c.row},${c.col},-,${c.value}`);
                    break;
                case ClueKind.Shore:
                    parts.push(`F,${c.row},${c.col},${toneChar(c.tone)},${c.value}`);
                    break;
                case ClueKind.Double:
                    parts.push(`D,${c.row},${c.col},${dirChar(c.dir)},${c.value}`);
                    break;
                default:
                    parts.push(`L,${c.row},${c.col},${dirChar(c.dir)},${c.value}`);
                    break;
            }
        }
        return parts.join(' ');
    }
    static fromLine(line) {
        if (line === null || line === undefined || line.trim().length === 0)
            throw new FormatError('empty puzzle line');
        // C#'s Split(' ', RemoveEmptyEntries): runs of spaces collapse, leading/trailing drop.
        const parts = line.split(' ').filter(s => s.length > 0);
        if (parts.length < 7)
            throw new FormatError('puzzle line needs at least 7 fields');
        const rows = parseInt32(parts[0], 'rows');
        const cols = parseInt32(parts[1], 'cols');
        const diff = parseInt32(parts[2], 'difficulty');
        const id = parts[3] === '-' ? null : parts[3];
        const chapter = parseInt32(parts[4], 'chapter');
        const title = parts[5] === '-' ? null : parts[5];
        // Guard before allocating rows*cols: a link claiming 100000x100000 must not be believed
        // far enough to allocate for it. The C# is protected by ShareCodec's inflate ceiling.
        if (rows <= 0 || cols <= 0 || rows * cols > 1_000_000)
            throw new FormatError(`impossible board size ${rows}x${cols}`);
        let solution = null;
        if (parts[6] !== '-') {
            if (parts[6].length !== rows * cols)
                throw new FormatError(`solution is ${parts[6].length} chars, expected ${rows * cols}`);
            solution = new Uint8Array(rows * cols);
            for (let i = 0; i < solution.length; i++) {
                const ch = parts[6][i];
                if (ch === ShadowChar)
                    solution[i] = Tone.Shadow;
                else if (ch === LightChar)
                    solution[i] = Tone.Light;
                else if (ch === GoldChar)
                    solution[i] = Tone.Gold;
                else
                    throw new FormatError(`bad solution char '${ch}'`);
            }
        }
        const clues = [];
        let mechanic = Mechanic.None;
        let walls = null;
        let groups = null;
        let pairs = null;
        let voids = null;
        for (let i = 7; i < parts.length; i++) {
            const f = parts[i].split(',');
            switch (f[0]) {
                case 'M': {
                    if (f.length !== 2)
                        throw new FormatError(`bad mechanic token '${parts[i]}'`);
                    const m = parseInt32(f[1], 'mechanic');
                    if (m < 0 || m > MaxMechanic)
                        throw new FormatError(`unknown mechanic '${m}'`);
                    mechanic = m;
                    break;
                }
                case 'W': {
                    if (f.length !== 5)
                        throw new FormatError(`bad wall token '${parts[i]}'`);
                    walls = walls ?? [];
                    walls.push(parseInt32(f[1], 'wall row') * cols + parseInt32(f[2], 'wall col'));
                    walls.push(parseInt32(f[3], 'wall row') * cols + parseInt32(f[4], 'wall col'));
                    break;
                }
                case 'G': {
                    if (f.length < 3)
                        throw new FormatError(`bad group token '${parts[i]}'`);
                    const g = new Array(f.length - 1);
                    for (let k = 1; k < f.length; k++)
                        g[k - 1] = parseInt32(f[k], 'group cell');
                    groups = groups ?? [];
                    groups.push(g);
                    break;
                }
                case 'P': {
                    if (f.length !== 5)
                        throw new FormatError(`bad pair token '${parts[i]}'`);
                    pairs = pairs ?? [];
                    pairs.push(parseInt32(f[1], 'pair row') * cols + parseInt32(f[2], 'pair col'));
                    pairs.push(parseInt32(f[3], 'pair row') * cols + parseInt32(f[4], 'pair col'));
                    break;
                }
                case 'V': {
                    if (f.length !== 3)
                        throw new FormatError(`bad void token '${parts[i]}'`);
                    voids = voids ?? [];
                    voids.push(parseInt32(f[1], 'void row') * cols + parseInt32(f[2], 'void col'));
                    break;
                }
                default: {
                    if (f.length !== 5)
                        throw new FormatError(`bad clue token '${parts[i]}'`);
                    const r = parseInt32(f[1], 'clue row');
                    const c = parseInt32(f[2], 'clue col');
                    const v = parseInt32(f[4], 'clue value');
                    if (f[0] === 'R')
                        clues.push(Clues.region(r, c, parseTone(f[3]), v));
                    else if (f[0] === 'L')
                        clues.push(Clues.line(r, c, parseDir(f[3][0]), v));
                    else if (f[0] === 'N')
                        clues.push(Clues.lantern(r, c, parseTone(f[3]), v));
                    else if (f[0] === 'T') {
                        if (f[3] !== 'L')
                            throw new FormatError(`bad tally token '${parts[i]}'`);
                        if (c === -1)
                            clues.push(Clues.rowTally(r, v));
                        else if (r === -1)
                            clues.push(Clues.colTally(c, v));
                        else
                            throw new FormatError(`tally token '${parts[i]}' must have row or col of -1`);
                    }
                    else if (f[0] === 'U') {
                        if (f[3] !== '-')
                            throw new FormatError(`bad open token '${parts[i]}'`);
                        clues.push(Clues.open(r, c, v));
                    }
                    else if (f[0] === 'X') {
                        if (f[3] !== '-')
                            throw new FormatError(`bad turnstile token '${parts[i]}'`);
                        if (c === -1)
                            clues.push(Clues.rowTurns(r, v));
                        else if (r === -1)
                            clues.push(Clues.colTurns(c, v));
                        else
                            throw new FormatError(`turnstile token '${parts[i]}' must have row or col of -1`);
                    }
                    else if (f[0] === 'C') {
                        if (f[3] !== '-')
                            throw new FormatError(`bad watch token '${parts[i]}'`);
                        clues.push(Clues.watch(r, c, v));
                    }
                    else if (f[0] === 'K')
                        clues.push(Clues.knight(r, c, parseTone(f[3]), v));
                    else if (f[0] === 'Y')
                        clues.push(Clues.cross(r, c, parseTone(f[3]), v));
                    else if (f[0] === 'E') {
                        if (f[3].length !== 2)
                            throw new FormatError(`crest token '${parts[i]}' needs a tone and a direction`);
                        // Clues.crest throws RangeError on a direction that is not Right or Down; a share
                        // link is attacker-supplied, so it becomes a FormatError like every other refusal.
                        try {
                            clues.push(Clues.crest(r, c, parseTone(f[3].substring(0, 1)), parseDir(f[3][1]), v));
                        }
                        catch (e) {
                            if (e instanceof FormatError)
                                throw e;
                            throw new FormatError(`bad crest token '${parts[i]}'`, { cause: e });
                        }
                    }
                    else if (f[0] === 'Q') {
                        if (f[3] !== '-')
                            throw new FormatError(`bad twin token '${parts[i]}'`);
                        clues.push(Clues.twin(r, c, v));
                    }
                    else if (f[0] === 'F')
                        clues.push(Clues.shore(r, c, parseTone(f[3]), v));
                    else if (f[0] === 'D')
                        clues.push(Clues.double(r, c, parseDir(f[3][0]), v));
                    else
                        throw new FormatError(`unknown clue kind '${f[0]}'`);
                    break;
                }
            }
        }
        return new Puzzle({
            rows, cols, clues, solution, difficulty: diff, id, chapter, title,
            mechanic, walls, groups, pairs, voids,
        });
    }
}
//# sourceMappingURL=puzzle.js.map
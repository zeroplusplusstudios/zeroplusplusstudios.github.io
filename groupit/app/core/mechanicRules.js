// Ported from Assets/_Project/Scripts/Core/Model/MechanicRules.cs
//
// The board-wide laws. Fifteen of the 32 mechanics are a law rather than a clue kind, and each
// gets two readings: verify on a complete grid (truth) and evaluate on a partial one (feedback).
//
// EVERY LIVE DETECTOR HERE IS DELIBERATELY CONSERVATIVE, and each carries the C# argument for
// why. The bar is the same one ClueEval sets: replaying a legal answer one mark at a time, in
// ANY order, must never raise a flag. That is why the comparison laws say nothing until both
// patches are SEALED, and why several sound-on-paper tightenings are explicitly declined.
//
// Note the two places that deliberately do NOT go through puzzle.neighbour: One Sky, All One
// Colour and Stray Light step DirRow/DirCol raw, because none of those laws ever shares a board
// with walls, a seam or voids. Carried across verbatim rather than "improved" — a flood that
// starts respecting walls on a board that has none is a behaviour change dressed as a cleanup.
import { Mechanic } from './mechanic.js';
import * as Regions from './regions.js';
import { ClueKind, Mark, Tone } from './types.js';
export function verifyLaw(p, grid, _failedClueIndices = null) {
    switch (p.mechanic) {
        case Mechanic.OneSky: return verifyOneSky(p, grid);
        case Mechanic.NoFullCourtyard: return verifyNoFullCourtyard(p, grid);
        case Mechanic.Duskfall: return verifyDuskfall(p, grid);
        case Mechanic.StrayLight: return verifyStrayLight(p, grid);
        case Mechanic.GasLine: return verifyGasLine(p, grid);
        case Mechanic.NeverThree: return verifyNeverThree(p, grid);
        case Mechanic.Windowlight: return verifyWindowlight(p, grid);
        case Mechanic.Rollcall: return verifyRollcall(p, grid);
        case Mechanic.Silhouette: return verifySilhouette(p, grid);
        case Mechanic.NeverTheLongStep: return verifyNeverTheLongStep(p, grid);
        case Mechanic.UnlikeNeighbours: return verifyUnlikeNeighbours(p, grid);
        case Mechanic.Weir: return verifyWeir(p, grid);
        case Mechanic.Scales: return verifyScales(p, grid);
        case Mechanic.AllOneColour: return verifyAllOneColour(p, grid);
        case Mechanic.EvenSplit: return verifyEvenSplit(p, grid);
        default: return true;
    }
}
export function evaluateLaw(p, marks, status) {
    switch (p.mechanic) {
        case Mechanic.OneSky:
            evaluateOneSky(p, marks, status);
            break;
        case Mechanic.NoFullCourtyard:
            evaluateNoFullCourtyard(p, marks, status);
            break;
        case Mechanic.Duskfall:
            evaluateDuskfall(p, marks, status);
            break;
        case Mechanic.StrayLight:
            evaluateStrayLight(p, marks, status);
            break;
        case Mechanic.GasLine:
            evaluateGasLine(p, marks, status);
            break;
        case Mechanic.NeverThree:
            evaluateNeverThree(p, marks, status);
            break;
        case Mechanic.Windowlight:
            evaluateWindowlight(p, marks, status);
            break;
        case Mechanic.Rollcall:
            evaluateSealedPairs(p, marks, status, 0 /* Law.Rollcall */);
            break;
        case Mechanic.Silhouette:
            evaluateSealedPairs(p, marks, status, 1 /* Law.Silhouette */);
            break;
        case Mechanic.NeverTheLongStep:
            evaluateNeverTheLongStep(p, marks, status);
            break;
        case Mechanic.UnlikeNeighbours:
            evaluateSealedPairs(p, marks, status, 2 /* Law.Unlike */);
            break;
        case Mechanic.Weir:
            evaluateWeir(p, marks, status);
            break;
        case Mechanic.Scales:
            evaluateScales(p, marks, status);
            break;
        case Mechanic.AllOneColour:
            evaluateAllOneColour(p, marks, status);
            break;
        case Mechanic.EvenSplit:
            evaluateEvenSplit(p, marks, status);
            break;
        default: break;
    }
}
// ───────────────────────────────────────────────────────────────── Windowlight
// No 2x2 block holds exactly three Light. That local ban is EQUIVALENT to the sentence the
// player is taught — every maximal Light region is a solid rectangle — and the equivalence was
// measured rather than asserted: over all 33,554,432 grids at 5x5 and 4,000,000 sampled at each
// of 6x5 and 7x5, zero mismatches in either direction.
//
// It is the exact inversion of NoFullCourtyard on the same window: a courtyard sees three alike
// and forbids the fourth, this sees three lit and REQUIRES it.
function verifyWindowlight(p, grid) {
    const rows = p.rows, cols = p.cols;
    for (let r = 0; r + 1 < rows; r++)
        for (let c = 0; c + 1 < cols; c++) {
            const i = r * cols + c;
            let lit = 0;
            if (grid[i] === Tone.Light)
                lit++;
            if (grid[i + 1] === Tone.Light)
                lit++;
            if (grid[i + cols] === Tone.Light)
                lit++;
            if (grid[i + cols + 1] === Tone.Light)
                lit++;
            if (lit === 3)
                return false;
        }
    return true;
}
// Live detector: a fully-committed window holding exactly three Lights is final, because
// committed marks do not move. A legal answer contains no such window, so replaying one mark by
// mark in any order never completes one.
function evaluateWindowlight(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let r = 0; r + 1 < rows; r++)
        for (let c = 0; c + 1 < cols; c++) {
            const i = r * cols + c;
            const win = [i, i + 1, i + cols, i + cols + 1];
            let lit = 0;
            let complete = true;
            for (const cell of win) {
                if (marks[cell] === Mark.Unknown) {
                    complete = false;
                    break;
                }
                if (marks[cell] === Mark.Light)
                    lit++;
            }
            if (!complete || lit !== 3)
                continue;
            for (const cell of win)
                status.cellBroken[cell] = 1;
            status.brokenLawCount++;
        }
}
// ───────────────────────────────────────────────────────── Never the Long Step
// No two Light cells sit a knight's move apart. Shadow is entirely unconstrained, and THAT
// ASYMMETRY IS THE MECHANIC rather than an oversight: a knight always changes square colour, so
// the knight graph is bipartite and connected on every board this game ships, which makes the
// symmetric version admit exactly two answers on any board — the two chessboard colourings.
function verifyNeverTheLongStep(p, grid) {
    const rows = p.rows, cols = p.cols;
    for (let i = 0; i < rows * cols; i++) {
        if (grid[i] !== Tone.Light)
            continue;
        const r = Math.floor(i / cols), c = i % cols;
        for (let k = 0; k < 8; k++) {
            const nr = r + Regions.KnightRow[k], nc = c + Regions.KnightCol[k];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
                continue;
            if (grid[nr * cols + nc] === Tone.Light)
                return false;
        }
    }
    return true;
}
// Live detector: two COMMITTED Lights a long step apart are final.
function evaluateNeverTheLongStep(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let i = 0; i < rows * cols; i++) {
        if (marks[i] !== Mark.Light)
            continue;
        const r = Math.floor(i / cols), c = i % cols;
        for (let k = 0; k < 8; k++) {
            const nr = r + Regions.KnightRow[k], nc = c + Regions.KnightCol[k];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
                continue;
            const ni = nr * cols + nc;
            if (ni < i || marks[ni] !== Mark.Light)
                continue; // each pair once
            status.cellBroken[i] = 1;
            status.cellBroken[ni] = 1;
            status.brokenLawCount++;
        }
    }
}
// ──────────────────────────────────────────────────────────────────── The Weir
// Ordered pairs, and the first asymmetric relation in the game: tail Light implies head Light,
// and never the reverse. The contrapositive is the half a player actually uses.
function verifyWeir(p, grid) {
    if (p.pairs === null)
        return true;
    for (let i = 0; i < p.pairs.length; i += 2)
        if (grid[p.pairs[i]] === Tone.Light && grid[p.pairs[i + 1]] !== Tone.Light)
            return false;
    return true;
}
// Live detector: a committed Light tail above a committed non-Light head can never agree again.
function evaluateWeir(p, marks, status) {
    if (p.pairs === null)
        return;
    for (let i = 0; i < p.pairs.length; i += 2) {
        const tail = p.pairs[i], head = p.pairs[i + 1];
        if (marks[tail] !== Mark.Light)
            continue;
        if (marks[head] === Mark.Unknown || marks[head] === Mark.Light)
            continue;
        status.cellBroken[tail] = 1;
        status.cellBroken[head] = 1;
        status.brokenLawCount++;
    }
}
// ────────────────────────────────────────────────────────────────── The Scales
// A chevron in the gap between two adjacent cells: the patch on the heavy side is STRICTLY
// larger than the patch on the light side. Two adjacent cells of one tone are one patch and no
// patch outweighs itself, so a chevron also splits the tones.
function verifyScales(p, grid) {
    if (p.pairs === null)
        return true;
    const sizeOf = Regions.sizePerCell(grid, p.rows, p.cols, p.walls, p.wraps, p.voidMask);
    for (let i = 0; i < p.pairs.length; i += 2) {
        const heavy = p.pairs[i], light = p.pairs[i + 1];
        if (grid[heavy] === grid[light])
            return false; // one patch, or a tie
        if (sizeOf[heavy] <= sizeOf[light])
            return false;
    }
    return true;
}
function evaluateScales(p, marks, status) {
    // Hoisted, not re-read through `p` below: the components() call between the guard and the
    // loop resets TypeScript's narrowing of a property access, so `p.pairs[i]` there is
    // `Int32Array | null` again and the guard above stops meaning anything.
    const pairs = p.pairs;
    if (pairs === null)
        return;
    const { comp, size, open } = components(p, marks);
    for (let i = 0; i < pairs.length; i += 2) {
        const heavy = pairs[i], light = pairs[i + 1];
        if (marks[heavy] === Mark.Unknown || marks[light] === Mark.Unknown)
            continue;
        let broken = marks[heavy] === marks[light];
        // Sizes only once both patches are sealed. An open patch's size is a floor and nothing
        // more, and rejecting on a floor prunes flawless play.
        if (!broken) {
            const a = comp[heavy], b = comp[light];
            if (a >= 0 && b >= 0 && !open[a] && !open[b] && size[a] <= size[b])
                broken = true;
        }
        if (!broken)
            continue;
        status.cellBroken[heavy] = 1;
        status.cellBroken[light] = 1;
        status.brokenLawCount++;
    }
}
// ───────────────────────────────── Rollcall · Silhouette · Unlike Neighbours
// Three laws that compare one finished patch against another, and therefore three laws whose
// live detector can say nothing at all until both patches are SEALED. That is not timidity, it
// is the only sound reading: an open component may still grow, may still merge with another
// component of its tone through an Unknown, and may end up any shape at all.
function verifyRollcall(p, grid) {
    const { n, label, sizes } = labelBoard(p, grid);
    const toneOf = tonePerRegion(p, grid, label, n);
    for (let a = 0; a < n; a++)
        for (let b = a + 1; b < n; b++)
            if (toneOf[a] === toneOf[b] && sizes[a] === sizes[b])
                return false;
    return true;
}
function verifySilhouette(p, grid) {
    const { n, label } = labelBoard(p, grid);
    const toneOf = tonePerRegion(p, grid, label, n);
    const seen = new Set();
    for (let id = 0; id < n; id++) {
        if (toneOf[id] !== Tone.Light)
            continue;
        const key = Regions.shapeKey(label, id, p.rows, p.cols);
        if (seen.has(key))
            return false;
        seen.add(key);
    }
    return true;
}
function verifyUnlikeNeighbours(p, grid) {
    const rows = p.rows, cols = p.cols;
    const { n, label, sizes } = labelBoard(p, grid);
    if (n <= 1)
        return true;
    for (let i = 0; i < rows * cols; i++) {
        if (label[i] < 0)
            continue;
        for (let d = 0; d < 4; d++) {
            const ni = p.neighbour(i, d);
            if (ni < 0 || label[ni] < 0 || label[ni] === label[i])
                continue;
            if (sizes[label[i]] === sizes[label[ni]])
                return false;
        }
    }
    return true;
}
/**
 * The shared live detector for the three comparison laws: flood the committed marks, then
 * compare SEALED components only.
 */
function evaluateSealedPairs(p, marks, status, law) {
    const { comp, size, open, members } = components(p, marks);
    const n = size.length;
    if (n < 2)
        return;
    for (let a = 0; a < n; a++) {
        if (open[a])
            continue;
        for (let b = a + 1; b < n; b++) {
            if (open[b])
                continue;
            let clash;
            switch (law) {
                case 0 /* Law.Rollcall */:
                    clash = marks[members[a][0]] === marks[members[b][0]] && size[a] === size[b];
                    break;
                case 1 /* Law.Silhouette */:
                    clash = marks[members[a][0]] === Mark.Light && marks[members[b][0]] === Mark.Light &&
                        shapeOf(p, members[a]) === shapeOf(p, members[b]);
                    break;
                default:
                    clash = size[a] === size[b] && touching(p, comp, members[a], b);
                    break;
            }
            if (!clash)
                continue;
            for (const cell of members[a])
                status.cellBroken[cell] = 1;
            for (const cell of members[b])
                status.cellBroken[cell] = 1;
            status.brokenLawCount++;
        }
    }
}
function touching(p, comp, members, other) {
    for (const cell of members)
        for (let d = 0; d < 4; d++) {
            const ni = p.neighbour(cell, d);
            if (ni >= 0 && comp[ni] === other)
                return true;
        }
    return false;
}
function shapeOf(p, members) {
    let minRow = Number.MAX_SAFE_INTEGER, minCol = Number.MAX_SAFE_INTEGER;
    for (const cell of members) {
        if (Math.floor(cell / p.cols) < minRow)
            minRow = Math.floor(cell / p.cols);
        if (cell % p.cols < minCol)
            minCol = cell % p.cols;
    }
    const cells = members.slice().sort((x, y) => x - y);
    let s = '';
    for (const cell of cells)
        s += `${Math.floor(cell / p.cols) - minRow},${(cell % p.cols) - minCol};`;
    return s;
}
function labelBoard(p, grid) {
    const label = new Int32Array(p.cellCount);
    const sizes = [];
    const n = Regions.label(grid, p.rows, p.cols, label, sizes, p.walls, p.wraps, p.voidMask);
    return { n, label, sizes };
}
function tonePerRegion(p, grid, label, n) {
    const toneOf = new Uint8Array(n);
    for (let i = 0; i < p.cellCount; i++)
        if (label[i] >= 0)
            toneOf[label[i]] = grid[i];
    return toneOf;
}
/**
 * Components of COMMITTED marks, with Unknown acting as a wall — the same shape ClueEval's
 * region pass builds, and the same meaning: a component here is what is already provably one
 * patch, and `open` says whether it can still change.
 */
function components(p, marks) {
    const cells = p.cellCount;
    const comp = new Int32Array(cells).fill(-1);
    const size = [];
    const open = [];
    const members = [];
    const stack = [];
    for (let start = 0; start < cells; start++) {
        if (comp[start] !== -1 || marks[start] === Mark.Unknown || p.isVoid(start))
            continue;
        const id = size.length;
        const mine = [];
        const mark = marks[start];
        let touchesUnknown = false;
        comp[start] = id;
        stack.length = 0;
        stack.push(start);
        while (stack.length > 0) {
            const cur = stack.pop();
            mine.push(cur);
            for (let d = 0; d < 4; d++) {
                const ni = p.neighbour(cur, d);
                if (ni < 0)
                    continue;
                if (marks[ni] === Mark.Unknown) {
                    touchesUnknown = true;
                    continue;
                }
                if (marks[ni] !== mark || comp[ni] !== -1)
                    continue;
                comp[ni] = id;
                stack.push(ni);
            }
        }
        size.push(mine.length);
        open.push(touchesUnknown);
        members.push(mine);
    }
    return { comp, size, open, members };
}
// ────────────────────────────────────────────────────────────────── Never Three
// No three cells in a row or column share a tone. The line sibling of NoFullCourtyard's square,
// and the sharper of the two to play: a courtyard needs three committed corners before it says
// anything, where this fires off two.
function verifyNeverThree(p, grid) {
    const rows = p.rows, cols = p.cols;
    for (let r = 0; r < rows; r++)
        for (let c = 0; c + 2 < cols; c++) {
            const i = r * cols + c;
            if (grid[i] === grid[i + 1] && grid[i] === grid[i + 2])
                return false;
        }
    for (let c = 0; c < cols; c++)
        for (let r = 0; r + 2 < rows; r++) {
            const i = r * cols + c;
            if (grid[i] === grid[i + cols] && grid[i] === grid[i + 2 * cols])
                return false;
        }
    return true;
}
// Live detector: three committed cells alike in a line are final.
function evaluateNeverThree(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let r = 0; r < rows; r++)
        for (let c = 0; c + 2 < cols; c++) {
            const i = r * cols + c;
            const m = marks[i];
            if (m === Mark.Unknown || marks[i + 1] !== m || marks[i + 2] !== m)
                continue;
            status.cellBroken[i] = 1;
            status.cellBroken[i + 1] = 1;
            status.cellBroken[i + 2] = 1;
            status.brokenLawCount++;
        }
    for (let c = 0; c < cols; c++)
        for (let r = 0; r + 2 < rows; r++) {
            const i = r * cols + c;
            const m = marks[i];
            if (m === Mark.Unknown || marks[i + cols] !== m || marks[i + 2 * cols] !== m)
                continue;
            status.cellBroken[i] = 1;
            status.cellBroken[i + cols] = 1;
            status.cellBroken[i + 2 * cols] = 1;
            status.brokenLawCount++;
        }
}
// ───────────────────────────────────────────────────────────────────── One Sky
// All Shadow forms a single connected piece. A board with no Shadow at all satisfies the law
// vacuously.
function verifyOneSky(p, grid) {
    return verifyOneColour(p, grid, Tone.Shadow);
}
// All One Colour is One Sky with the tone swapped, so the two share a body. The C# spells both
// out; folding them is safe because neither reads anything but the tone it is given.
function verifyOneColour(p, grid, want) {
    const rows = p.rows, cols = p.cols, cells = rows * cols;
    let start = -1, total = 0;
    for (let i = 0; i < cells; i++)
        if (grid[i] === want) {
            if (start < 0)
                start = i;
            total++;
        }
    if (start < 0)
        return true;
    const seen = new Uint8Array(cells);
    const stack = [];
    seen[start] = 1;
    stack.push(start);
    let reached = 0;
    while (stack.length > 0) {
        const cur = stack.pop();
        reached++;
        const r = Math.floor(cur / cols), c = cur % cols;
        for (let d = 0; d < 4; d++) {
            const nr = r + Regions.DirRow[d], nc = c + Regions.DirCol[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
                continue;
            const ni = nr * cols + nc;
            if (seen[ni] !== 0 || grid[ni] !== want)
                continue;
            seen[ni] = 1;
            stack.push(ni);
        }
    }
    return reached === total;
}
// Live detector: flood the {want ∪ Unknown} area around the first committed cell of that tone.
// A committed cell of that tone outside the area can never connect to it — every joining path
// would pass through a committed cell of the other tone — and the law allows exactly one piece,
// so the whole colour is wrong together and gets the wash together.
//
// Conservative because on a replayed answer every answer cell of that tone is either already
// committed or still Unknown, so the answer's single component lies entirely inside one
// {want ∪ Unknown} area — no split is ever seen.
function evaluateOneColour(p, marks, status, want) {
    const rows = p.rows, cols = p.cols, cells = rows * cols;
    let start = -1;
    for (let i = 0; i < cells; i++)
        if (marks[i] === want) {
            start = i;
            break;
        }
    if (start < 0)
        return;
    const seen = new Uint8Array(cells);
    const stack = [];
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
        const cur = stack.pop();
        const r = Math.floor(cur / cols), c = cur % cols;
        for (let d = 0; d < 4; d++) {
            const nr = r + Regions.DirRow[d], nc = c + Regions.DirCol[d];
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
                continue;
            const ni = nr * cols + nc;
            if (seen[ni] !== 0)
                continue;
            if (marks[ni] !== want && marks[ni] !== Mark.Unknown)
                continue;
            seen[ni] = 1;
            stack.push(ni);
        }
    }
    let split = false;
    for (let i = 0; i < cells; i++)
        if (marks[i] === want && seen[i] === 0) {
            split = true;
            break;
        }
    if (!split)
        return;
    status.brokenLawCount++;
    for (let i = 0; i < cells; i++)
        if (marks[i] === want)
            status.cellBroken[i] = 1;
}
function evaluateOneSky(p, marks, status) {
    evaluateOneColour(p, marks, status, Mark.Shadow);
}
// ─────────────────────────────────────────────────────────── No Full Courtyard
// No 2x2 block may be a single tone — any single tone, Gold included, though Gold never
// actually shares a board with a law.
function verifyNoFullCourtyard(p, grid) {
    const rows = p.rows, cols = p.cols;
    for (let r = 0; r + 1 < rows; r++)
        for (let c = 0; c + 1 < cols; c++) {
            const i = r * cols + c;
            const t = grid[i];
            if (grid[i + 1] === t && grid[i + cols] === t && grid[i + cols + 1] === t)
                return false;
        }
    return true;
}
// Live detector: a fully-committed monochrome 2x2 is final.
function evaluateNoFullCourtyard(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let r = 0; r + 1 < rows; r++)
        for (let c = 0; c + 1 < cols; c++) {
            const i = r * cols + c;
            const m = marks[i];
            if (m === Mark.Unknown)
                continue;
            if (marks[i + 1] !== m || marks[i + cols] !== m || marks[i + cols + 1] !== m)
                continue;
            status.cellBroken[i] = 1;
            status.cellBroken[i + 1] = 1;
            status.cellBroken[i + cols] = 1;
            status.cellBroken[i + cols + 1] = 1;
            status.brokenLawCount++;
        }
}
// ───────────────────────────────────────────────────────────────────── Duskfall
// Night falls from the top: in every column, all Shadow sits above all Light. A Light strictly
// above a Shadow in the same column breaks the law.
function verifyDuskfall(p, grid) {
    const rows = p.rows, cols = p.cols;
    for (let c = 0; c < cols; c++) {
        let lightSeen = false;
        for (let r = 0; r < rows; r++) {
            const t = grid[r * cols + c];
            if (t === Tone.Light)
                lightSeen = true;
            else if (t === Tone.Shadow && lightSeen)
                return false;
        }
    }
    return true;
}
// Live detector: a committed Light above a committed Shadow is final.
function evaluateDuskfall(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let c = 0; c < cols; c++) {
        let firstLightRow = Number.MAX_SAFE_INTEGER, lastShadowRow = -1;
        for (let r = 0; r < rows; r++) {
            const m = marks[r * cols + c];
            if (m === Mark.Light && r < firstLightRow)
                firstLightRow = r;
            else if (m === Mark.Shadow && r > lastShadowRow)
                lastShadowRow = r;
        }
        if (firstLightRow >= lastShadowRow)
            continue;
        // Wash every cell of the column that takes part in some inverted pair.
        status.brokenLawCount++;
        for (let r = 0; r < rows; r++) {
            const m = marks[r * cols + c];
            if (m === Mark.Light && r < lastShadowRow)
                status.cellBroken[r * cols + c] = 1;
            else if (m === Mark.Shadow && r > firstLightRow)
                status.cellBroken[r * cols + c] = 1;
        }
    }
}
// ─────────────────────────────────────────────────────────────── No Stray Light
// Every Light region must contain a Light region clue.
function verifyStrayLight(p, grid) {
    const rows = p.rows, cols = p.cols, cells = rows * cols;
    // Deliberately the plain labelling — no walls, no wrap, no voids. Stray Light never shares a
    // board with any of them, and the C# passes none. Carried across as written.
    const label = new Int32Array(cells);
    const n = Regions.label(grid, rows, cols, label, null);
    const hasClue = new Uint8Array(n);
    for (let i = 0; i < p.clues.length; i++) {
        const clue = p.clues[i];
        if (clue.kind === ClueKind.Region && clue.tone === Tone.Light)
            hasClue[label[clue.row * cols + clue.col]] = 1;
    }
    for (let i = 0; i < cells; i++)
        if (grid[i] === Tone.Light && hasClue[label[i]] === 0)
            return false;
    return true;
}
// Live detector: a committed Light pool whose entire frontier is committed is final — it is a
// maximal Light region in every completion — so if no Light region clue sits inside it, no
// completion licenses it. Deliberately NOT here: flagging a pool that merely cannot reach any
// Light clue through its remaining Unknowns. That rule is sound on paper and one subtle
// reachability bug away from flagging flawless play; verify catches those boards at the end.
function evaluateStrayLight(p, marks, status) {
    const rows = p.rows, cols = p.cols, cells = rows * cols;
    const component = new Int32Array(cells).fill(-1);
    const lightClueAt = new Uint8Array(cells);
    for (let i = 0; i < p.clues.length; i++) {
        const clue = p.clues[i];
        if (clue.kind === ClueKind.Region && clue.tone === Tone.Light)
            lightClueAt[clue.row * cols + clue.col] = 1;
    }
    const stack = [];
    let next = 0;
    for (let start = 0; start < cells; start++) {
        if (component[start] !== -1 || marks[start] !== Mark.Light)
            continue;
        const id = next++;
        const members = [];
        component[start] = id;
        stack.length = 0;
        stack.push(start);
        let touchesUnknown = false, hasClue = false;
        while (stack.length > 0) {
            const cur = stack.pop();
            members.push(cur);
            if (lightClueAt[cur] !== 0)
                hasClue = true;
            const r = Math.floor(cur / cols), c = cur % cols;
            for (let d = 0; d < 4; d++) {
                const nr = r + Regions.DirRow[d], nc = c + Regions.DirCol[d];
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
                    continue;
                const ni = nr * cols + nc;
                if (marks[ni] === Mark.Unknown) {
                    touchesUnknown = true;
                    continue;
                }
                if (marks[ni] !== Mark.Light || component[ni] !== -1)
                    continue;
                component[ni] = id;
                stack.push(ni);
            }
        }
        if (touchesUnknown || hasClue)
            continue;
        status.brokenLawCount++;
        for (const m of members)
            status.cellBroken[m] = 1;
    }
}
// ───────────────────────────────────────────────────────────────────── Gas Line
// Every group's members share one tone. The tap UI flips a group together, but undo, seeds and
// hand-built marks can still disagree — the law is the truth, not the UI.
function verifyGasLine(p, grid) {
    if (p.groups === null)
        return true;
    for (const g of p.groups) {
        const t = grid[g[0]];
        for (let k = 1; k < g.length; k++)
            if (grid[g[k]] !== t)
                return false;
    }
    return true;
}
// Live detector: two committed members with different marks can never agree again.
function evaluateGasLine(p, marks, status) {
    if (p.groups === null)
        return;
    for (const g of p.groups) {
        let first = Mark.Unknown;
        let conflict = false;
        for (const cell of g) {
            const m = marks[cell];
            if (m === Mark.Unknown)
                continue;
            if (first === Mark.Unknown)
                first = m;
            else if (m !== first) {
                conflict = true;
                break;
            }
        }
        if (!conflict)
            continue;
        status.brokenLawCount++;
        for (const cell of g)
            status.cellBroken[cell] = 1;
    }
}
// ────────────────────────────────────────────────────────────── All One Colour
// One Sky with the tone swapped: all LIGHT forms a single connected piece.
function verifyAllOneColour(p, grid) {
    return verifyOneColour(p, grid, Tone.Light);
}
function evaluateAllOneColour(p, marks, status) {
    evaluateOneColour(p, marks, status, Mark.Light);
}
// ────────────────────────────────────────────────────────────────── Even Split
// Every row and every column holds exactly half Light, half Shadow — no printed clue anywhere;
// the target is the line's own length. Chapters carrying this keep both rows and cols even
// throughout, so "half" is always a whole number.
function verifyEvenSplit(p, grid) {
    const rows = p.rows, cols = p.cols;
    for (let r = 0; r < rows; r++) {
        let light = 0;
        for (let c = 0; c < cols; c++)
            if (grid[r * cols + c] === Tone.Light)
                light++;
        if (light * 2 !== cols)
            return false;
    }
    for (let c = 0; c < cols; c++) {
        let light = 0;
        for (let r = 0; r < rows; r++)
            if (grid[r * cols + c] === Tone.Light)
                light++;
        if (light * 2 !== rows)
            return false;
    }
    return true;
}
// Live detector: a row or column whose committed cells already spend more than half of either
// tone cannot recover in any completion.
function evaluateEvenSplit(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    const rowTarget = Math.floor(cols / 2), colTarget = Math.floor(rows / 2);
    for (let r = 0; r < rows; r++) {
        let light = 0, shadow = 0;
        for (let c = 0; c < cols; c++) {
            const m = marks[r * cols + c];
            if (m === Mark.Light)
                light++;
            else if (m === Mark.Shadow)
                shadow++;
        }
        if (light <= rowTarget && shadow <= rowTarget)
            continue;
        status.brokenLawCount++;
        for (let c = 0; c < cols; c++)
            status.cellBroken[r * cols + c] = 1;
    }
    for (let c = 0; c < cols; c++) {
        let light = 0, shadow = 0;
        for (let r = 0; r < rows; r++) {
            const m = marks[r * cols + c];
            if (m === Mark.Light)
                light++;
            else if (m === Mark.Shadow)
                shadow++;
        }
        if (light <= colTarget && shadow <= colTarget)
            continue;
        status.brokenLawCount++;
        for (let r = 0; r < rows; r++)
            status.cellBroken[r * cols + c] = 1;
    }
}
//# sourceMappingURL=mechanicRules.js.map
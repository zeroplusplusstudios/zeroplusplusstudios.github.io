// Ported from Assets/_Project/Scripts/Core/Model/ClueEval.cs
//
// The rules, in one place. Two jobs:
//   * verify   — is this fully-assigned grid a legal solution? (truth)
//   * evaluate — what is provably wrong on this half-filled board? (feedback)
//
// verify never consults puzzle.solution. A win is earned by satisfying the printed clues, not
// by matching a stored answer — which also means the win check doubles as a uniqueness
// assertion every time a player finishes a board.
//
// THE DIRECTION OF EVERY BOUND IN `evaluate` IS LOAD-BEARING. It flags only what is *already
// impossible*, never a guess about where the player is heading. A detector that flags too late
// costs a player nothing; one that flags too early shows a red board to somebody playing
// perfectly. Every bound below is therefore deliberately loose, and the C# comments explaining
// which direction each one errs in are carried across with the code.
import { isMargin, locksItsCell, namesItsPatchSize } from './clue.js';
import { Mechanic } from './mechanic.js';
import * as MechanicRules from './mechanicRules.js';
import { Status } from './status.js';
import * as Regions from './regions.js';
import { ClueKind, Dir, Mark, markToTone, Tone, toneToMark } from './types.js';
/**
 * True for a Region clue that is being read as a DEGREE rather than as a size — a Shadow
 * region clue on a SecondReading board and nothing else.
 *
 * Asked here rather than spelled out at each site because a false size assertion inside a
 * uniqueness counter is an UNDER-count, so a two-answer board is proven unique and ships.
 */
export function isDegreeClue(p, clue) {
    return p.mechanic === Mechanic.SecondReading && clue.kind === ClueKind.Region &&
        clue.tone === Tone.Shadow;
}
/**
 * Same-tone cells a knight's move from (row, col), the cell itself never counted — it is not
 * knight-reachable from itself. Nothing blocks the count: set membership over eight fixed
 * offsets, not a ray, so walls and other cells are irrelevant.
 */
export function knightSeen(p, grid, row, col, tone) {
    let seen = 0;
    for (let k = 0; k < 8; k++) {
        const r = row + Regions.KnightRow[k], c = col + Regions.KnightCol[k];
        if (r < 0 || r >= p.rows || c < 0 || c >= p.cols)
            continue;
        const ni = r * p.cols + c;
        if (p.isVoid(ni))
            continue;
        if (grid[ni] === tone)
            seen++;
    }
    return seen;
}
/**
 * Same-tone cells down the whole row plus across the whole column, the clue's own cell counted
 * exactly once — hence the minus one, and hence the smallest legal value of 1.
 */
export function crossSeen(p, grid, row, col, tone) {
    let total = 0;
    const base = row * p.cols;
    for (let c = 0; c < p.cols; c++)
        if (!p.isVoid(base + c) && grid[base + c] === tone)
            total++;
    for (let r = 0; r < p.rows; r++)
        if (!p.isVoid(r * p.cols + col) && grid[r * p.cols + col] === tone)
            total++;
    return total - 1;
}
/**
 * The size of the largest region holding any cell of the line a crest reads — over BOTH tones,
 * which is the half of the rule a reader skims past.
 */
export function crestLargest(p, sizeOf, clue) {
    let best = 0;
    if (clue.dir === Dir.Right) {
        const base = clue.row * p.cols;
        for (let c = 0; c < p.cols; c++)
            if (!p.isVoid(base + c) && sizeOf[base + c] > best)
                best = sizeOf[base + c];
    }
    else {
        for (let r = 0; r < p.rows; r++) {
            const idx = r * p.cols + clue.col;
            if (!p.isVoid(idx) && sizeOf[idx] > best)
                best = sizeOf[idx];
        }
    }
    return best;
}
/** True when every clue holds and the board's law (if any) holds, on a complete grid. */
export function verify(p, grid, failedClueIndices = null) {
    if (grid === null || grid.length !== p.cellCount)
        throw new Error('grid must be rows*cols');
    if (failedClueIndices !== null)
        failedClueIndices.length = 0;
    // One labelling, shared by every clue below. Three of the newer kinds need more than a size:
    // a crest wants the largest region touching a line, a shoreline a perimeter, a second-reading
    // clue a region's DEGREE. Wrap and voids are threaded here and nowhere else in this function,
    // which is what keeps the Seam and the Well from having to be remembered at every clue.
    const cells = p.cellCount;
    const lab = new Int32Array(cells);
    const sizes = [];
    Regions.label(grid, p.rows, p.cols, lab, sizes, p.walls, p.wraps, p.voidMask);
    const sizeOf = new Int32Array(cells);
    for (let i = 0; i < cells; i++)
        sizeOf[i] = lab[i] < 0 ? 0 : sizes[lab[i]];
    const degrees = p.mechanic === Mechanic.SecondReading;
    const wallSet = p.walls === null ? null : Regions.buildWallSet(p.walls);
    let ok = true;
    for (let i = 0; i < p.clues.length; i++) {
        const clue = p.clues[i];
        let good;
        switch (clue.kind) {
            case ClueKind.Region: {
                const idx = clue.row * p.cols + clue.col;
                if (grid[idx] !== clue.tone) {
                    good = false;
                    break;
                }
                // The Second Reading: on THAT board and no other, a Shadow region clue counts the
                // patches touching its patch rather than the cells inside it. The tone selects the
                // rule; a Light clue is untouched.
                good = degrees && clue.tone === Tone.Shadow
                    ? Regions.degree(lab, lab[idx], p.rows, p.cols, p.wraps, p.voidMask, wallSet) === clue.value
                    : sizeOf[idx] === clue.value;
                break;
            }
            case ClueKind.Watch: {
                const idx = clue.row * p.cols + clue.col;
                let lit = 0;
                for (let d = 0; d < 4; d++) {
                    const ni = Regions.step(idx, d, p.rows, p.cols, p.wraps, p.voidMask);
                    if (ni >= 0 && grid[ni] === Tone.Light)
                        lit++;
                }
                good = lit === clue.value;
                break;
            }
            case ClueKind.Knight: {
                const idx = clue.row * p.cols + clue.col;
                good = grid[idx] === clue.tone && knightSeen(p, grid, clue.row, clue.col, clue.tone) === clue.value;
                break;
            }
            case ClueKind.Cross: {
                const idx = clue.row * p.cols + clue.col;
                good = grid[idx] === clue.tone && crossSeen(p, grid, clue.row, clue.col, clue.tone) === clue.value;
                break;
            }
            case ClueKind.Crest: {
                // The own-tone conjunct is load-bearing and easy to leave out. Without it the clue says
                // nothing about the cell it stands on, every board of the chapter becomes
                // colour-symmetric, and the bake rejects all of them as non-unique — an evaluator bug
                // wearing a generator bug's clothes.
                const idx = clue.row * p.cols + clue.col;
                good = grid[idx] === clue.tone && crestLargest(p, sizeOf, clue) === clue.value;
                break;
            }
            case ClueKind.Shore: {
                const idx = clue.row * p.cols + clue.col;
                good = grid[idx] === clue.tone &&
                    Regions.perimeterOf(lab, lab[idx], p.rows, p.cols, p.wraps, p.voidMask) === clue.value;
                break;
            }
            case ClueKind.Twin: {
                // A twin asserts equality against the other cells wearing its letter, so it is checked
                // once per letter rather than once per clue — every member reports the same verdict,
                // which is what makes a broken pair redden both ends rather than an arbitrary one.
                const idx = clue.row * p.cols + clue.col;
                good = true;
                for (let j = 0; j < p.clues.length && good; j++) {
                    if (j === i || p.clues[j].kind !== ClueKind.Twin || p.clues[j].value !== clue.value)
                        continue;
                    const other = p.clues[j].row * p.cols + p.clues[j].col;
                    if (sizeOf[other] !== sizeOf[idx])
                        good = false;
                }
                break;
            }
            case ClueKind.Double: {
                // Both readings of one number, and both are somebody else's rule verbatim: the region
                // half is Open's (size, tone withheld), the ray half is Line's with the count pinned
                // one higher.
                const idx = clue.row * p.cols + clue.col;
                if (sizeOf[idx] !== clue.value) {
                    good = false;
                    break;
                }
                const { horizontal: horiz, lo: dLo, hi: dHi } = Regions.lineRange(clue.dir, clue.row, clue.col, p.rows, p.cols);
                const runs = horiz
                    ? Regions.segmentsAlongRow(grid, p.cols, clue.row, dLo, dHi)
                    : Regions.segmentsAlongCol(grid, p.cols, clue.col, dLo, dHi);
                good = runs === clue.value + 1;
                break;
            }
            case ClueKind.Open: {
                // Same rule as Region minus the tone conjunct — any tone whose region measures Value.
                const idx = clue.row * p.cols + clue.col;
                good = sizeOf[idx] === clue.value;
                break;
            }
            case ClueKind.Lantern: {
                const idx = clue.row * p.cols + clue.col;
                good = grid[idx] === clue.tone &&
                    Regions.lanternSeen(grid, p.rows, p.cols, clue.row, clue.col) === clue.value;
                break;
            }
            case ClueKind.Tally: {
                // Off-grid: exactly one of row/col is -1, the other names the line.
                let lights = 0;
                if (clue.col < 0) {
                    const base = clue.row * p.cols;
                    for (let c = 0; c < p.cols; c++)
                        if (grid[base + c] === Tone.Light)
                            lights++;
                }
                else {
                    for (let r = 0; r < p.rows; r++)
                        if (grid[r * p.cols + clue.col] === Tone.Light)
                            lights++;
                }
                good = lights === clue.value;
                break;
            }
            case ClueKind.Turns: {
                // The WHOLE line, end to end. That is the one thing separating this from a Line clue,
                // whose range starts at the cell it stands on — and it is why the same printed number
                // means the same thing wherever the clue sits.
                good = (clue.col < 0
                    ? Regions.segmentsAlongRow(grid, p.cols, clue.row, 0, p.cols - 1)
                    : Regions.segmentsAlongCol(grid, p.cols, clue.col, 0, p.rows - 1)) === clue.value;
                break;
            }
            default: {
                const { horizontal, lo, hi } = Regions.lineRange(clue.dir, clue.row, clue.col, p.rows, p.cols);
                const segs = horizontal
                    ? Regions.segmentsAlongRow(grid, p.cols, clue.row, lo, hi)
                    : Regions.segmentsAlongCol(grid, p.cols, clue.col, lo, hi);
                good = segs === clue.value;
                break;
            }
        }
        if (good)
            continue;
        ok = false;
        if (failedClueIndices === null)
            return false;
        failedClueIndices.push(i);
    }
    // Laws are board-wide: no single clue owns one, so a failed law flips the verdict without
    // contributing to failedClueIndices.
    if (!MechanicRules.verifyLaw(p, grid, failedClueIndices))
        ok = false;
    return ok;
}
/**
 * Live feedback on a partial board. Flags only what is *already impossible* — never a guess
 * about where the player is heading. Unknown cells act as walls for connectivity, so a region
 * that is still open is judged on "can it still reach N?", not "is it N?".
 */
export function evaluate(p, marks, status) {
    if (marks === null || marks.length !== p.cellCount)
        throw new Error('marks must be rows*cols');
    if (status === null)
        throw new Error('status is required');
    const cells = p.rows * p.cols;
    status.reset(cells, p.clues.length);
    // A void takes no Mark and never will, so it must not be counted as an open cell — otherwise
    // a finished Well board never reads as complete and never wins.
    const voidMask = p.voidMask;
    let unknown = 0;
    for (let i = 0; i < cells; i++)
        if (marks[i] === Mark.Unknown && (voidMask === null || voidMask[i] === 0))
            unknown++;
    status.committed = p.playableCells - unknown;
    status.complete = unknown === 0;
    evaluateRegionClues(p, marks, status);
    evaluateLineClues(p, marks, status);
    evaluateLanternClues(p, marks, status);
    evaluateTallyClues(p, marks, status);
    evaluateTurnsClues(p, marks, status);
    evaluateNeighbourhoodClues(p, marks, status);
    evaluateComponentClues(p, marks, status);
    MechanicRules.evaluateLaw(p, marks, status);
    if (status.complete && status.brokenClueCount === 0 && status.brokenLawCount === 0) {
        const grid = new Uint8Array(cells);
        for (let i = 0; i < cells; i++)
            grid[i] = markToTone(marks[i]);
        status.solved = verify(p, grid);
    }
}
/**
 * Region-shaped clues: Region proper, and Open once its cell is committed. An Open clue with
 * its cell still Unknown says nothing yet — the player has not chosen which region it measures
 * — so it stays silent rather than guessing.
 */
function evaluateRegionClues(p, marks, status) {
    const rows = p.rows, cols = p.cols, cells = rows * cols;
    const component = new Int32Array(cells).fill(-1);
    const stack = [];
    // Scratch for the envelope flood. Stamped with the component id rather than cleared, so the
    // whole of this function costs one allocation no matter how many components are measured.
    const envelope = new Int32Array(cells).fill(-1);
    // Map cell -> region-shaped clue index for O(1) lookup while flooding.
    const regionClueAt = new Int32Array(cells).fill(-1);
    for (let i = 0; i < p.clues.length; i++) {
        // A Second Reading clue prints like a region clue and means something else, so it must
        // never enter this map. Everything downstream reads a value in here as "cells in this
        // patch"; leaving a degree in would deduce false tones and raise contradictions against
        // flawless play.
        if (isDegreeClue(p, p.clues[i]))
            continue;
        // A Double's region half IS an Open clue — same rule, tone withheld — so it rides this
        // machinery unchanged and its ray half is handled with the arrows.
        if (namesItsPatchSize(p.clues[i]))
            regionClueAt[p.clues[i].row * cols + p.clues[i].col] = i;
    }
    let nextComponent = 0;
    for (let start = 0; start < cells; start++) {
        if (component[start] !== -1 || marks[start] === Mark.Unknown)
            continue;
        if (p.isVoid(start))
            continue;
        const mark = marks[start];
        const id = nextComponent++;
        const members = [];
        const clueValues = [];
        const clueIndices = [];
        component[start] = id;
        stack.length = 0;
        stack.push(start);
        let touchesUnknown = false;
        while (stack.length > 0) {
            const cur = stack.pop();
            members.push(cur);
            const clueIdx = regionClueAt[cur];
            if (clueIdx >= 0) {
                clueIndices.push(clueIdx);
                clueValues.push(p.clues[clueIdx].value);
            }
            for (let d = 0; d < 4; d++) {
                // A walled edge is not a frontier: nothing crosses it in any completion, so an Unknown
                // behind a wall must not keep this region "growable". The same is true of a void and,
                // in the other direction, of the seam — which is why the question is asked of the
                // puzzle rather than of DirRow.
                const ni = p.neighbour(cur, d);
                if (ni < 0)
                    continue;
                if (marks[ni] === Mark.Unknown) {
                    touchesUnknown = true;
                    continue;
                }
                if (marks[ni] !== mark || component[ni] !== -1)
                    continue;
                component[ni] = id;
                stack.push(ni);
            }
        }
        if (clueIndices.length === 0)
            continue;
        const size = members.length;
        let broken = false;
        // Loose strictness: several clues may sit on one region, but they must agree.
        const target = clueValues[0];
        for (let i = 1; i < clueValues.length; i++)
            if (clueValues[i] !== target) {
                broken = true;
                break;
            }
        if (!broken) {
            if (size > target)
                broken = true; // already too big
            else if (!touchesUnknown && size !== target)
                broken = true; // sealed at wrong size
            else if (size < target &&
                reach(marks, members, mark, target, regionClueAt, p, envelope, id, stack) < target)
                broken = true; // can never reach N
        }
        // A region clue also asserts its own cell's tone; the player cannot edit those cells, but a
        // pack could still ship an inconsistent clue. An Open clue withholds its tone.
        if (!broken) {
            for (const ci of clueIndices) {
                const clue = p.clues[ci];
                if (clue.kind !== ClueKind.Region)
                    continue;
                if (markToTone(marks[clue.row * cols + clue.col]) !== clue.tone) {
                    broken = true;
                    break;
                }
            }
        }
        if (!broken)
            continue;
        for (const ci of clueIndices) {
            if (status.clueBroken[ci] !== 0)
                continue;
            status.clueBroken[ci] = 1;
            status.brokenClueCount++;
        }
        for (const m of members) {
            status.cellBroken[m] = 1;
            status.patchBroken[m] = 1; // the patch half specifically — see Status
        }
    }
}
/**
 * The largest the region containing this component could still become — a flood outward from
 * every member over cells that are either the same mark already or still Unknown.
 *
 * This is the sound upper bound, and getting it right matters more than it sounds. The obvious
 * cheap version — "my size, plus every Unknown left on the board" — is wrong in *both*
 * directions at once. Too generous, because it credits a region with Unknowns on the far side
 * of the board it could never reach. Far too mean, because it refuses to count the other
 * same-tone components sitting one Unknown cell away: fill that cell and the two are one
 * region. Swept across the pack, the arithmetic version raised a contradiction on a
 * provably-correct partial board on 32 of the 63 shipped boards.
 *
 * Over-counting is the safe direction: it means a contradiction is reported late rather than
 * falsely. One tightening is worth its three lines: the flood refuses to cross a same-tone
 * cell carrying a REGION clue that disagrees with ours. Open clues are exempt from that
 * refusal — their cells stay player-editable, so leaning on one risks the false-contradiction
 * class this comment is about.
 */
function reach(marks, members, mark, target, regionClueAt, p, stamp, id, stack) {
    stack.length = 0;
    for (const m of members) {
        if (stamp[m] === id)
            continue;
        stamp[m] = id;
        stack.push(m);
    }
    let total = 0;
    while (stack.length > 0) {
        const cur = stack.pop();
        total++;
        for (let d = 0; d < 4; d++) {
            const ni = p.neighbour(cur, d);
            if (ni < 0)
                continue;
            if (stamp[ni] === id)
                continue;
            if (marks[ni] !== mark && marks[ni] !== Mark.Unknown)
                continue;
            if (marks[ni] === mark) {
                const other = regionClueAt[ni];
                if (other >= 0 && p.clues[other].kind === ClueKind.Region && p.clues[other].value !== target)
                    continue;
            }
            stamp[ni] = id;
            stack.push(ni);
        }
    }
    return total;
}
function evaluateLineClues(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let i = 0; i < p.clues.length; i++) {
        const clue = p.clues[i];
        if (clue.kind !== ClueKind.Line && clue.kind !== ClueKind.Double)
            continue;
        // A Double's ray holds Value+1 runs; a Line's holds Value. One line of arithmetic rather
        // than a second copy of the bounds below.
        const wantRuns = clue.kind === ClueKind.Double ? clue.value + 1 : clue.value;
        const { horizontal, lo, hi } = Regions.lineRange(clue.dir, clue.row, clue.col, rows, cols);
        // Walk the ray once: count the runs among committed cells and the gaps that could still
        // become extra runs. A gap of G unknown cells can add at most G new runs; the committed
        // runs are the floor.
        let committedRuns = 0, unknownCells = 0;
        let prev = Mark.Unknown;
        let anyUnknown = false;
        for (let k = lo; k <= hi; k++) {
            const idx = horizontal ? clue.row * cols + k : k * cols + clue.col;
            const m = marks[idx];
            if (m === Mark.Unknown) {
                anyUnknown = true;
                unknownCells++;
                prev = Mark.Unknown;
                continue;
            }
            if (prev !== m)
                committedRuns++;
            prev = m;
        }
        let broken;
        if (!anyUnknown) {
            broken = committedRuns !== wantRuns;
        }
        else {
            let minRuns = Math.max(1, committedRuns - unknownCells);
            let maxRuns = committedRuns + unknownCells;
            if (committedRuns === 0) {
                minRuns = 1;
                maxRuns = Math.max(1, unknownCells);
            }
            broken = wantRuns < minRuns || wantRuns > maxRuns;
        }
        if (!broken)
            continue;
        if (status.clueBroken[i] !== 0)
            continue; // a Double may already be broken on its patch
        status.clueBroken[i] = 1;
        status.brokenClueCount++;
        for (let k = lo; k <= hi; k++) {
            const idx = horizontal ? clue.row * cols + k : k * cols + clue.col;
            status.cellBroken[idx] = 1;
        }
    }
}
/**
 * Lanterns on a partial board. Per arm the committed same-tone prefix is a floor — those cells
 * are already seen and cannot be unseen — and the run of same-or-Unknown cells up to the first
 * committed different mark is a ceiling. Every completion's true count sits inside
 * [1+Σfloor, 1+Σceiling], so flagging outside that window is conservative.
 */
function evaluateLanternClues(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let i = 0; i < p.clues.length; i++) {
        const clue = p.clues[i];
        if (clue.kind !== ClueKind.Lantern)
            continue;
        const idx = clue.row * cols + clue.col;
        const self = marks[idx];
        // Lantern cells are printed givens and arrive committed; if a seed ever leaves one open
        // there is nothing sound to say yet.
        if (self === Mark.Unknown)
            continue;
        const want = toneToMark(clue.tone);
        // The clue asserts its own cell's tone; the cell is locked, so a mismatch means an
        // inconsistent pack — the same guard the region clues carry.
        let broken = self !== want;
        if (!broken) {
            let minSeen = 0, maxSeen = 0;
            for (let d = 0; d < 4; d++) {
                let inPrefix = true;
                let r = clue.row + Regions.DirRow[d], c = clue.col + Regions.DirCol[d];
                while (r >= 0 && r < rows && c >= 0 && c < cols) {
                    const m = marks[r * cols + c];
                    if (m === want) {
                        if (inPrefix)
                            minSeen++;
                        maxSeen++;
                    }
                    else if (m === Mark.Unknown) {
                        inPrefix = false;
                        maxSeen++;
                    }
                    else
                        break;
                    r += Regions.DirRow[d];
                    c += Regions.DirCol[d];
                }
            }
            broken = clue.value < 1 + minSeen || clue.value > 1 + maxSeen;
        }
        if (!broken)
            continue;
        status.clueBroken[i] = 1;
        status.brokenClueCount++;
        // Wash the cells that take part in the count: self plus everything each arm could still
        // see — the lantern's whole possible field of view.
        status.cellBroken[idx] = 1;
        for (let d = 0; d < 4; d++) {
            let r = clue.row + Regions.DirRow[d], c = clue.col + Regions.DirCol[d];
            while (r >= 0 && r < rows && c >= 0 && c < cols) {
                const m = marks[r * cols + c];
                if (m !== want && m !== Mark.Unknown)
                    break;
                status.cellBroken[r * cols + c] = 1;
                r += Regions.DirRow[d];
                c += Regions.DirCol[d];
            }
        }
    }
}
/**
 * Tallies on a partial board. Committed Lights only ever rise and Unknowns are the only
 * headroom, so the count is provably wrong exactly when it has already overshot or can no
 * longer get there. Gold and Shadow both count as "not Light" — correct for either.
 */
function evaluateTallyClues(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let i = 0; i < p.clues.length; i++) {
        const clue = p.clues[i];
        if (clue.kind !== ClueKind.Tally)
            continue;
        let lights = 0, unknown = 0;
        if (clue.col < 0) {
            const base = clue.row * cols;
            for (let c = 0; c < cols; c++) {
                const m = marks[base + c];
                if (m === Mark.Light)
                    lights++;
                else if (m === Mark.Unknown)
                    unknown++;
            }
        }
        else {
            for (let r = 0; r < rows; r++) {
                const m = marks[r * cols + clue.col];
                if (m === Mark.Light)
                    lights++;
                else if (m === Mark.Unknown)
                    unknown++;
            }
        }
        if (lights <= clue.value && lights + unknown >= clue.value)
            continue;
        status.clueBroken[i] = 1;
        status.brokenClueCount++;
        if (clue.col < 0) {
            const base = clue.row * cols;
            for (let c = 0; c < cols; c++)
                status.cellBroken[base + c] = 1;
        }
        else {
            for (let r = 0; r < rows; r++)
                status.cellBroken[r * cols + clue.col] = 1;
        }
    }
}
/**
 * Turnstiles on a partial board, a strictly harder question than a tally's. A tally counts
 * Lights and a committed Light never becomes un-Light. A run count does neither: filling an
 * Unknown can raise it (a new band) or lower it (bridging two bands into one), so "already
 * overshot" cannot be said about it. What CAN be said is a range.
 *
 * Both ends are deliberately loose, because a false flag here is a red board shown to somebody
 * playing perfectly. The floor counts changes between CONSECUTIVE COMMITTED cells, gaps
 * ignored. The ceiling counts every boundary that touches an Unknown as though it could be
 * made to change — on a two-tone board they cannot all be, but over-estimating the ceiling
 * costs detections, never correctness.
 */
function evaluateTurnsClues(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let i = 0; i < p.clues.length; i++) {
        const clue = p.clues[i];
        if (clue.kind !== ClueKind.Turns)
            continue;
        const horizontal = clue.col < 0;
        const length = horizontal ? cols : rows;
        let floor = 0, ceiling = 0;
        let previousCommitted = Mark.Unknown;
        for (let k = 0; k < length; k++) {
            const m = marks[horizontal ? clue.row * cols + k : k * cols + clue.col];
            if (k > 0) {
                const before = marks[horizontal ? clue.row * cols + k - 1 : (k - 1) * cols + clue.col];
                if (before === Mark.Unknown || m === Mark.Unknown)
                    ceiling++;
                else if (before !== m)
                    ceiling++;
            }
            if (m === Mark.Unknown)
                continue;
            if (previousCommitted !== Mark.Unknown && previousCommitted !== m)
                floor++;
            previousCommitted = m;
        }
        // Value counts runs; the board prints changes, and changes is what these bounds are in.
        const changes = clue.value - 1;
        if (changes >= floor && changes <= ceiling)
            continue;
        status.clueBroken[i] = 1;
        status.brokenClueCount++;
        for (let k = 0; k < length; k++)
            status.cellBroken[horizontal ? clue.row * cols + k : k * cols + clue.col] = 1;
    }
}
/**
 * The three clues that read a fixed set of cells rather than a region or a ray: the watch's
 * four neighbours, the knight's eight long steps, and the crossroads' whole row and column.
 *
 * All three take the same bound. Let `lo` be the cells of the wanted tone already committed
 * inside the set and `u` the cells still Unknown. Every completion's count lands in
 * [lo, lo + u], so a printed value outside that interval is impossible in EVERY completion.
 */
function evaluateNeighbourhoodClues(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let i = 0; i < p.clues.length; i++) {
        const clue = p.clues[i];
        if (clue.kind !== ClueKind.Watch && clue.kind !== ClueKind.Knight && clue.kind !== ClueKind.Cross)
            continue;
        const idx = clue.row * cols + clue.col;
        let broken = false;
        // The two kinds that state their own tone lock their cell, so a mismatch means an
        // inconsistent pack — the same guard the region and lantern clues carry.
        if (locksItsCell(clue) && marks[idx] !== Mark.Unknown && markToTone(marks[idx]) !== clue.tone)
            broken = true;
        let lo = 0, unknown = 0;
        const wanted = clue.kind === ClueKind.Watch ? Mark.Light : toneToMark(clue.tone);
        const touched = [];
        if (clue.kind === ClueKind.Watch) {
            for (let d = 0; d < 4; d++) {
                const ni = Regions.step(idx, d, rows, cols, p.wraps, p.voidMask);
                if (ni < 0)
                    continue;
                touched.push(ni);
                if (marks[ni] === wanted)
                    lo++;
                else if (marks[ni] === Mark.Unknown)
                    unknown++;
            }
        }
        else if (clue.kind === ClueKind.Knight) {
            for (let k = 0; k < 8; k++) {
                const r = clue.row + Regions.KnightRow[k], c = clue.col + Regions.KnightCol[k];
                if (r < 0 || r >= rows || c < 0 || c >= cols)
                    continue;
                const ni = r * cols + c;
                if (p.isVoid(ni))
                    continue;
                touched.push(ni);
                if (marks[ni] === wanted)
                    lo++;
                else if (marks[ni] === Mark.Unknown)
                    unknown++;
            }
        }
        else {
            // Row then column, the shared cell counted twice and taken back once — exactly the
            // arithmetic the printed number is defined by.
            const base = clue.row * cols;
            for (let c = 0; c < cols; c++) {
                const ni = base + c;
                if (p.isVoid(ni))
                    continue;
                touched.push(ni);
                if (marks[ni] === wanted)
                    lo++;
                else if (marks[ni] === Mark.Unknown)
                    unknown++;
            }
            for (let r = 0; r < rows; r++) {
                const ni = r * cols + clue.col;
                if (p.isVoid(ni))
                    continue;
                if (r !== clue.row)
                    touched.push(ni);
                if (marks[ni] === wanted)
                    lo++;
                else if (marks[ni] === Mark.Unknown)
                    unknown++;
            }
            if (marks[idx] === wanted)
                lo--;
            else if (marks[idx] === Mark.Unknown)
                unknown--;
        }
        if (!broken && (clue.value < lo || clue.value > lo + unknown))
            broken = true;
        if (!broken)
            continue;
        status.clueBroken[i] = 1;
        status.brokenClueCount++;
        status.cellBroken[idx] = 1;
        for (const cell of touched)
            status.cellBroken[cell] = 1;
    }
}
/**
 * The four clues whose subject is a whole COMPONENT rather than a cell or a line — a crest's
 * biggest patch, a shoreline's fence, a twin's unstated size, and a second reading's degree.
 *
 * Every one of them is judged on sealed components only, and the discipline is not optional. A
 * component of committed marks that touches no Unknown is a final region of every completion,
 * so its size, perimeter and shape are settled; one that still touches an Unknown may grow,
 * merge, or change shape entirely, and the only thing monotone about it is its AREA. So: exact
 * comparisons on sealed components, and on open ones nothing but the area floor.
 */
function evaluateComponentClues(p, marks, status) {
    let any = false;
    for (let i = 0; i < p.clues.length && !any; i++) {
        const c = p.clues[i];
        if (c.kind === ClueKind.Crest || c.kind === ClueKind.Shore || c.kind === ClueKind.Twin ||
            isDegreeClue(p, c))
            any = true;
    }
    if (!any)
        return;
    const rows = p.rows, cols = p.cols, cells = rows * cols;
    // Flood the committed marks into components. Unknown acts as a wall, exactly as it does for
    // the region clues above, so a component here is "what is provably one patch already".
    const comp = new Int32Array(cells).fill(-1);
    const size = [];
    const open = [];
    const stack = [];
    const members = [];
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
    for (let i = 0; i < p.clues.length; i++) {
        const clue = p.clues[i];
        const crest = clue.kind === ClueKind.Crest, shore = clue.kind === ClueKind.Shore;
        const twin = clue.kind === ClueKind.Twin;
        const degree = isDegreeClue(p, clue);
        if (!crest && !shore && !twin && !degree)
            continue;
        const idx = clue.row * cols + clue.col;
        let broken = false;
        if (locksItsCell(clue) && marks[idx] !== Mark.Unknown && markToTone(marks[idx]) !== clue.tone)
            broken = true;
        const id = comp[idx];
        if (!broken && crest) {
            // Only the CAP arm, and it needs no sealing test: a component's size is monotone as the
            // board fills, so one that already exceeds the crest and already holds a cell of the
            // crest's line will exceed it in every completion. The existence half — that something
            // in the line must REACH the number — cannot be bounded from a partial board.
            for (let k = 0; k < size.length && !broken; k++) {
                if (size[k] <= clue.value)
                    continue;
                for (const cell of members[k]) {
                    const inLine = clue.dir === Dir.Right
                        ? Math.floor(cell / cols) === clue.row
                        : cell % cols === clue.col;
                    if (inLine) {
                        broken = true;
                        break;
                    }
                }
            }
        }
        if (!broken && shore && id >= 0) {
            const { maxArea } = Regions.areaRangeForPerimeter(clue.value, cells);
            if (size[id] > maxArea)
                broken = true; // area is monotone
            else if (!open[id]) {
                // Sealed: the shape is final, so the fence is exactly computable.
                let fence = 0;
                for (const cell of members[id])
                    for (let d = 0; d < 4; d++) {
                        const ni = Regions.step(cell, d, rows, cols, p.wraps, p.voidMask);
                        if (ni < 0 || comp[ni] !== id)
                            fence++;
                    }
                if (fence !== clue.value)
                    broken = true;
            }
        }
        if (!broken && twin && id >= 0) {
            for (let j = 0; j < p.clues.length && !broken; j++) {
                if (j === i || p.clues[j].kind !== ClueKind.Twin || p.clues[j].value !== clue.value)
                    continue;
                const otherIdx = p.clues[j].row * cols + p.clues[j].col;
                const other = comp[otherIdx];
                if (other < 0)
                    continue;
                // Both sealed: the two sizes are final and must match. One sealed and the other already
                // past it: area only grows, so it can never come back down.
                if (!open[id] && !open[other] && size[id] !== size[other])
                    broken = true;
                else if (!open[id] && size[other] > size[id])
                    broken = true;
                else if (!open[other] && size[id] > size[other])
                    broken = true;
            }
        }
        if (!broken && degree && id >= 0) {
            // Sealed neighbours only. A sealed neighbour is a final region, it is the other tone by
            // maximality so this patch can never absorb it, and two sealed neighbours can never merge
            // with each other — so counting them is a sound LOWER bound on the final degree.
            const distinct = new Set();
            for (const cell of members[id])
                for (let d = 0; d < 4; d++) {
                    const ni = p.neighbour(cell, d);
                    if (ni < 0 || comp[ni] < 0 || comp[ni] === id)
                        continue;
                    if (open[comp[ni]])
                        continue;
                    distinct.add(comp[ni]);
                }
            if (distinct.size > clue.value)
                broken = true;
        }
        if (!broken)
            continue;
        if (status.clueBroken[i] !== 0)
            continue;
        status.clueBroken[i] = 1;
        status.brokenClueCount++;
        status.cellBroken[idx] = 1;
        if (id >= 0)
            for (const cell of members[id])
                status.cellBroken[cell] = 1;
    }
}
// Re-exported so a caller that only wants the rules does not also import clue.js, and so
// `Status` is still reachable from here — it moved to status.ts only to break the import
// cycle with mechanicRules (see that file's header).
export { isMargin, Status };
//# sourceMappingURL=clueEval.js.map
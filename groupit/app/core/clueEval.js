import { isMargin, locksItsCell, namesItsPatchSize } from './clue.js';
import { Mechanic } from './mechanic.js';
import * as MechanicRules from './mechanicRules.js';
import { Status } from './status.js';
import * as Regions from './regions.js';
import { ClueKind, Dir, Mark, markToTone, Tone, toneToMark } from './types.js';
export function isDegreeClue(p, clue) {
    return p.mechanic === Mechanic.SecondReading && clue.kind === ClueKind.Region &&
        clue.tone === Tone.Shadow;
}
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
export function verify(p, grid, failedClueIndices = null) {
    if (grid === null || grid.length !== p.cellCount)
        throw new Error('grid must be rows*cols');
    if (failedClueIndices !== null)
        failedClueIndices.length = 0;
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
    if (!MechanicRules.verifyLaw(p, grid, failedClueIndices))
        ok = false;
    return ok;
}
export function evaluate(p, marks, status) {
    if (marks === null || marks.length !== p.cellCount)
        throw new Error('marks must be rows*cols');
    if (status === null)
        throw new Error('status is required');
    const cells = p.rows * p.cols;
    status.reset(cells, p.clues.length);
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
function evaluateRegionClues(p, marks, status) {
    const rows = p.rows, cols = p.cols, cells = rows * cols;
    const component = new Int32Array(cells).fill(-1);
    const stack = [];
    const envelope = new Int32Array(cells).fill(-1);
    const regionClueAt = new Int32Array(cells).fill(-1);
    for (let i = 0; i < p.clues.length; i++) {
        if (isDegreeClue(p, p.clues[i]))
            continue;
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
        const target = clueValues[0];
        for (let i = 1; i < clueValues.length; i++)
            if (clueValues[i] !== target) {
                broken = true;
                break;
            }
        if (!broken) {
            if (size > target)
                broken = true;
            else if (!touchesUnknown && size !== target)
                broken = true;
            else if (size < target &&
                reach(marks, members, mark, target, regionClueAt, p, envelope, id, stack) < target)
                broken = true;
        }
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
            status.patchBroken[m] = 1;
        }
    }
}
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
        const wantRuns = clue.kind === ClueKind.Double ? clue.value + 1 : clue.value;
        const { horizontal, lo, hi } = Regions.lineRange(clue.dir, clue.row, clue.col, rows, cols);
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
            continue;
        status.clueBroken[i] = 1;
        status.brokenClueCount++;
        for (let k = lo; k <= hi; k++) {
            const idx = horizontal ? clue.row * cols + k : k * cols + clue.col;
            status.cellBroken[idx] = 1;
        }
    }
}
function evaluateLanternClues(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let i = 0; i < p.clues.length; i++) {
        const clue = p.clues[i];
        if (clue.kind !== ClueKind.Lantern)
            continue;
        const idx = clue.row * cols + clue.col;
        const self = marks[idx];
        if (self === Mark.Unknown)
            continue;
        const want = toneToMark(clue.tone);
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
        const changes = clue.value - 1;
        if (changes >= floor && changes <= ceiling)
            continue;
        status.clueBroken[i] = 1;
        status.brokenClueCount++;
        for (let k = 0; k < length; k++)
            status.cellBroken[horizontal ? clue.row * cols + k : k * cols + clue.col] = 1;
    }
}
function evaluateNeighbourhoodClues(p, marks, status) {
    const rows = p.rows, cols = p.cols;
    for (let i = 0; i < p.clues.length; i++) {
        const clue = p.clues[i];
        if (clue.kind !== ClueKind.Watch && clue.kind !== ClueKind.Knight && clue.kind !== ClueKind.Cross)
            continue;
        const idx = clue.row * cols + clue.col;
        let broken = false;
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
                broken = true;
            else if (!open[id]) {
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
                if (!open[id] && !open[other] && size[id] !== size[other])
                    broken = true;
                else if (!open[id] && size[other] > size[id])
                    broken = true;
                else if (!open[other] && size[id] > size[other])
                    broken = true;
            }
        }
        if (!broken && degree && id >= 0) {
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
export { isMargin, Status };

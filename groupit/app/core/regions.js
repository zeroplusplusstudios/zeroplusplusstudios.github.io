// Ported from Assets/_Project/Scripts/Core/Model/Regions.cs
//
// Connectivity over a tone grid. A *region* is a maximal orthogonally-connected set of
// same-tone cells — "maximal" is the whole game: two same-tone regions can never touch,
// because if they touched they would already be one region.
//
// Walls (GardenWalls) cut individual edges. They affect connectivity ONLY: label and
// sizePerCell take an optional wall list, while segmentsAlongRow/Col stay wall-blind on
// purpose — arrows see over walls.
import { Dir, Tone } from './types.js';
export const DirRow = [0, 0, -1, 1];
export const DirCol = [1, -1, 0, 0];
/**
 * The eight squares a knight's move away. Used by two mechanics that share nothing else.
 * They are NOT an adjacency: nothing floods along them, and a walk that treated them as
 * neighbours would build regions the rules have never heard of.
 */
export const KnightRow = [-2, -2, -1, -1, 1, 1, 2, 2];
export const KnightCol = [-1, 1, -2, 2, -2, 2, -1, 1];
/**
 * The cell orthogonally adjacent to `cell` in direction `d`, or -1 when there is none.
 *
 * Two mechanics change what "adjacent" means, and they change it everywhere at once. Seam
 * joins column 0 to column cols-1. Well punches holes: a void is the neighbour of nothing.
 * Both are properties of the BOARD rather than of any one rule, which is why this is one
 * function instead of a branch inside a dozen flood loops.
 *
 * Rows never wrap. A cylinder keeps the top and bottom edges the search's prefix ordering
 * depends on; a torus does not. The wrap is refused below three columns, where it would only
 * return a cell that is already a neighbour.
 */
export function step(cell, d, rows, cols, wrap = false, isVoid = null) {
    const r = Math.floor(cell / cols) + DirRow[d];
    let c = (cell % cols) + DirCol[d];
    if (r < 0 || r >= rows)
        return -1;
    if (c < 0 || c >= cols) {
        if (!wrap || cols < 3)
            return -1;
        c = ((c % cols) + cols) % cols;
    }
    const ni = r * cols + c;
    if (isVoid !== null && isVoid[ni] !== 0)
        return -1;
    return ni;
}
// Same keying as puzzle.walled — order-normalised, safe for any grid under 10000 cells.
export function wallKey(a, b) {
    return a < b ? a * 10000 + b : b * 10000 + a;
}
export function buildWallSet(walls) {
    if (walls === null || walls.length === 0)
        return null;
    const set = new Set();
    for (let i = 0; i + 1 < walls.length; i += 2)
        set.add(wallKey(walls[i], walls[i + 1]));
    return set;
}
/**
 * Labels every cell with its region id and returns the count of regions. `labelOut` must be
 * rows*cols long; it receives the id per cell. `sizesOut`, when given, is filled with the
 * size of each region indexed by id.
 */
export function label(grid, rows, cols, labelOut, sizesOut, walls = null, wrap = false, isVoid = null) {
    const cells = rows * cols;
    if (labelOut.length < cells)
        throw new Error('labelOut too small');
    const wallSet = buildWallSet(walls);
    for (let i = 0; i < cells; i++)
        labelOut[i] = -1;
    // Voids are stamped -2 rather than left at -1, so "not yet visited" and "not a cell at all"
    // are the same test. A void that kept -1 would start a region of its own.
    if (isVoid !== null) {
        for (let i = 0; i < cells; i++)
            if (isVoid[i] !== 0)
                labelOut[i] = -2;
    }
    if (sizesOut !== null)
        sizesOut.length = 0;
    const stack = [];
    let next = 0;
    for (let start = 0; start < cells; start++) {
        if (labelOut[start] !== -1)
            continue;
        const tone = grid[start];
        const id = next++;
        let size = 0;
        labelOut[start] = id;
        stack.push(start);
        while (stack.length > 0) {
            const cur = stack.pop();
            size++;
            for (let d = 0; d < 4; d++) {
                const ni = step(cur, d, rows, cols, wrap, isVoid);
                if (ni < 0)
                    continue;
                if (labelOut[ni] !== -1 || grid[ni] !== tone)
                    continue;
                if (wallSet !== null && wallSet.has(wallKey(cur, ni)))
                    continue;
                labelOut[ni] = id;
                stack.push(ni);
            }
        }
        if (sizesOut !== null)
            sizesOut.push(size);
    }
    return next;
}
/** Size of the region containing each cell, indexed row-major. */
export function sizePerCell(grid, rows, cols, walls = null, wrap = false, isVoid = null) {
    const lab = new Int32Array(rows * cols);
    const sizes = [];
    label(grid, rows, cols, lab, sizes, walls, wrap, isVoid);
    const out = new Int32Array(rows * cols);
    for (let i = 0; i < out.length; i++)
        out[i] = lab[i] < 0 ? 0 : sizes[lab[i]];
    return out;
}
/**
 * The perimeter of the region containing `cell`: unit edges facing a different tone, a void,
 * or the outside of the board. With A cells and E internally adjacent pairs this is 4A - 2E,
 * so every value is even and never less than 4.
 */
export function perimeter(grid, rows, cols, cell, walls = null, wrap = false, isVoid = null) {
    const lab = new Int32Array(rows * cols);
    label(grid, rows, cols, lab, null, walls, wrap, isVoid);
    return perimeterOf(lab, lab[cell], rows, cols, wrap, isVoid);
}
/** The same measurement off an already-labelled grid. */
export function perimeterOf(lab, id, rows, cols, wrap = false, isVoid = null) {
    if (id < 0)
        return 0;
    let edges = 0;
    for (let i = 0; i < rows * cols; i++) {
        if (lab[i] !== id)
            continue;
        for (let d = 0; d < 4; d++) {
            const ni = step(i, d, rows, cols, wrap, isVoid);
            if (ni < 0 || lab[ni] !== id)
                edges++;
        }
    }
    return edges;
}
/**
 * The least perimeter any connected set of `area` cells can have: 2 * ceil(2 * sqrt(A)).
 * Verified against every fixed polyomino to area 9 — 4, 6, 8, 8, 10, 10, 12, 12, 12.
 */
export function minPerimeterFor(area) {
    if (area <= 0)
        return 0;
    let side = Math.ceil(2.0 * Math.sqrt(area));
    // Guard the floating-point boundary: nudge until the square genuinely holds it.
    while (Math.floor(side / 2) * Math.floor((side + 1) / 2) < area)
        side++;
    while (side > 1 && Math.floor((side - 1) / 2) * Math.floor(side / 2) >= area)
        side--;
    return 2 * side;
}
/** The area interval a printed perimeter allows: [minArea, maxArea], inclusive. */
export function areaRangeForPerimeter(perim, cellCount) {
    const minArea = Math.max(1, Math.floor((perim - 2) / 2));
    let maxArea = 0;
    for (let a = 1; a <= cellCount; a++)
        if (minPerimeterFor(a) <= perim)
            maxArea = a;
    if (maxArea < minArea)
        maxArea = minArea;
    return { minArea, maxArea };
}
/**
 * How many DISTINCT regions share at least one edge with region `id` — its degree in the
 * adjacency graph. By maximality every one of them is the other tone.
 */
export function degree(lab, id, rows, cols, wrap = false, isVoid = null, wallSet = null) {
    if (id < 0)
        return 0;
    const seen = new Set();
    for (let i = 0; i < rows * cols; i++) {
        if (lab[i] !== id)
            continue;
        for (let d = 0; d < 4; d++) {
            const ni = step(i, d, rows, cols, wrap, isVoid);
            if (ni < 0 || lab[ni] === id || lab[ni] < 0)
                continue;
            if (wallSet !== null && wallSet.has(wallKey(i, ni)))
                continue;
            seen.add(lab[ni]);
        }
    }
    return seen.size;
}
/**
 * A region's shape, as a canonical string: its cells sorted, translated so the bounding box's
 * top-left sits at the origin. Turned copies are DIFFERENT shapes, deliberately — folding all
 * eight symmetries together is stricter and cannot be said inside a teaching page's budget.
 */
export function shapeKey(lab, id, rows, cols) {
    let minRow = Number.MAX_SAFE_INTEGER, minCol = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < rows * cols; i++) {
        if (lab[i] !== id)
            continue;
        const r = Math.floor(i / cols), c = i % cols;
        if (r < minRow)
            minRow = r;
        if (c < minCol)
            minCol = c;
    }
    if (minRow === Number.MAX_SAFE_INTEGER)
        return '';
    let s = '';
    for (let i = 0; i < rows * cols; i++) {
        if (lab[i] !== id)
            continue;
        s += `${Math.floor(i / cols) - minRow},${(i % cols) - minCol};`;
    }
    return s;
}
/**
 * What a lantern at (row, col) sees: itself plus the contiguous run of same-tone cells along
 * each of the four arms. Deliberately NOT wall-aware — lanterns and walls never share a
 * board, because a puzzle carries exactly one mechanic.
 */
export function lanternSeen(grid, rows, cols, row, col) {
    const tone = grid[row * cols + col];
    let seen = 1;
    for (let d = 0; d < 4; d++) {
        let r = row + DirRow[d], c = col + DirCol[d];
        while (r >= 0 && r < rows && c >= 0 && c < cols && grid[r * cols + c] === tone) {
            seen++;
            r += DirRow[d];
            c += DirCol[d];
        }
    }
    return seen;
}
/**
 * Number of maximal same-tone runs along a straight ray. Symmetric — reversing the ray cannot
 * change how many colour changes it contains — so a clue's direction only selects the *range*
 * of cells, never the order they are counted in.
 */
export function segmentsAlongRow(grid, cols, row, fromCol, toCol) {
    const lo = Math.min(fromCol, toCol), hi = Math.max(fromCol, toCol);
    let n = 1;
    const base = row * cols;
    for (let c = lo + 1; c <= hi; c++)
        if (grid[base + c] !== grid[base + c - 1])
            n++;
    return n;
}
export function segmentsAlongCol(grid, cols, col, fromRow, toRow) {
    const lo = Math.min(fromRow, toRow), hi = Math.max(fromRow, toRow);
    let n = 1;
    for (let r = lo + 1; r <= hi; r++)
        if (grid[r * cols + col] !== grid[(r - 1) * cols + col])
            n++;
    return n;
}
/** The inclusive cell range a line clue covers, as (lo, hi) along its axis. */
export function lineRange(dir, row, col, rows, cols) {
    switch (dir) {
        case Dir.Right: return { horizontal: true, lo: col, hi: cols - 1 };
        case Dir.Left: return { horizontal: true, lo: 0, hi: col };
        case Dir.Up: return { horizontal: false, lo: 0, hi: row };
        default: return { horizontal: false, lo: row, hi: rows - 1 };
    }
}
// Tone is re-exported so callers that only need connectivity do not also import types.js.
export { Tone };
//# sourceMappingURL=regions.js.map
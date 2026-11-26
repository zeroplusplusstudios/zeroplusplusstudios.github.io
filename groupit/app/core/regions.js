import { Dir, Tone } from './types.js';
export const DirRow = [0, 0, -1, 1];
export const DirCol = [1, -1, 0, 0];
export const KnightRow = [-2, -2, -1, -1, 1, 1, 2, 2];
export const KnightCol = [-1, 1, -2, 2, -2, 2, -1, 1];
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
export function label(grid, rows, cols, labelOut, sizesOut, walls = null, wrap = false, isVoid = null) {
    const cells = rows * cols;
    if (labelOut.length < cells)
        throw new Error('labelOut too small');
    const wallSet = buildWallSet(walls);
    for (let i = 0; i < cells; i++)
        labelOut[i] = -1;
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
export function sizePerCell(grid, rows, cols, walls = null, wrap = false, isVoid = null) {
    const lab = new Int32Array(rows * cols);
    const sizes = [];
    label(grid, rows, cols, lab, sizes, walls, wrap, isVoid);
    const out = new Int32Array(rows * cols);
    for (let i = 0; i < out.length; i++)
        out[i] = lab[i] < 0 ? 0 : sizes[lab[i]];
    return out;
}
export function perimeter(grid, rows, cols, cell, walls = null, wrap = false, isVoid = null) {
    const lab = new Int32Array(rows * cols);
    label(grid, rows, cols, lab, null, walls, wrap, isVoid);
    return perimeterOf(lab, lab[cell], rows, cols, wrap, isVoid);
}
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
export function minPerimeterFor(area) {
    if (area <= 0)
        return 0;
    let side = Math.ceil(2.0 * Math.sqrt(area));
    while (Math.floor(side / 2) * Math.floor((side + 1) / 2) < area)
        side++;
    while (side > 1 && Math.floor((side - 1) / 2) * Math.floor(side / 2) >= area)
        side--;
    return 2 * side;
}
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
export function lineRange(dir, row, col, rows, cols) {
    switch (dir) {
        case Dir.Right: return { horizontal: true, lo: col, hi: cols - 1 };
        case Dir.Left: return { horizontal: true, lo: 0, hi: col };
        case Dir.Up: return { horizontal: false, lo: 0, hi: row };
        default: return { horizontal: false, lo: row, hi: rows - 1 };
    }
}
export { Tone };

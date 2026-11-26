import { cellIndex, namesItsPatchSize } from './clue.js';
import * as Regions from './regions.js';
import { Mark } from './types.js';
export const Slots = 6;
export const None = -1;
const Apart = 2;
export function tag(marks, rows, cols, idOut, sizeOut, slotOut, puzzle = null) {
    if (marks === null || marks === undefined)
        throw new Error('marks is null');
    const cells = rows * cols;
    if (idOut === null || idOut.length < cells)
        throw new Error('idOut: too small');
    if (sizeOut === null || sizeOut.length < cells)
        throw new Error('sizeOut: too small');
    if (slotOut === null || slotOut.length < cells)
        throw new Error('slotOut: too small');
    for (let i = 0; i < cells; i++) {
        idOut[i] = None;
        sizeOut[i] = 0;
        slotOut[i] = None;
    }
    const flooded = flood(marks, rows, cols, cells, idOut, puzzle);
    const groups = flooded.groups;
    if (groups === 0)
        return 0;
    const slots = colour(marks, rows, cols, cells, idOut, groups, flooded.anchors, flooded.sizes);
    for (let i = 0; i < cells; i++) {
        const id = idOut[i];
        if (id === None)
            continue;
        sizeOut[i] = flooded.sizes[id];
        slotOut[i] = slots[id];
    }
    return groups;
}
export function labelCells(groupId, cells, groups, puzzle, labelOut) {
    if (groupId === null || groupId === undefined)
        throw new Error('groupId is null');
    if (labelOut === null || labelOut.length < groups)
        throw new Error('labelOut: too small');
    for (let g = 0; g < groups; g++)
        labelOut[g] = None;
    if (puzzle !== null)
        for (const clue of puzzle.clues) {
            if (!namesItsPatchSize(clue))
                continue;
            const cell = cellIndex(clue, puzzle.cols);
            if (cell < 0 || cell >= cells || cell >= groupId.length)
                continue;
            const g = groupId[cell];
            if (g === None || g >= groups)
                continue;
            if (labelOut[g] === None || cell < labelOut[g])
                labelOut[g] = cell;
        }
    for (let i = 0; i < cells && i < groupId.length; i++) {
        const g = groupId[i];
        if (g !== None && g < groups && labelOut[g] === None)
            labelOut[g] = i;
    }
}
function flood(marks, rows, cols, cells, idOut, puzzle) {
    const stack = new Int32Array(cells);
    const anchorBuf = new Int32Array(cells);
    const sizeBuf = new Int32Array(cells);
    let groups = 0;
    for (let start = 0; start < cells; start++) {
        if (marks[start] === Mark.Unknown || idOut[start] !== None)
            continue;
        const tone = marks[start];
        const id = groups++;
        let size = 0;
        let top = 0;
        idOut[start] = id;
        stack[top++] = start;
        while (top > 0) {
            const cur = stack[--top];
            size++;
            for (let d = 0; d < 4; d++) {
                const ni = puzzle !== null
                    ? puzzle.neighbour(cur, d)
                    : Regions.step(cur, d, rows, cols);
                if (ni < 0)
                    continue;
                if (idOut[ni] !== None || marks[ni] !== tone)
                    continue;
                idOut[ni] = id;
                stack[top++] = ni;
            }
        }
        anchorBuf[id] = start;
        sizeBuf[id] = size;
    }
    return { groups, anchors: anchorBuf, sizes: sizeBuf };
}
function colour(marks, rows, cols, cells, idOut, groups, anchors, sizes) {
    const starts = new Int32Array(groups + 1);
    for (let i = 0; i < cells; i++)
        if (idOut[i] !== None)
            starts[idOut[i] + 1]++;
    for (let id = 0; id < groups; id++)
        starts[id + 1] += starts[id];
    const cursor = starts.slice(0, groups);
    const ordered = new Int32Array(starts[groups]);
    for (let i = 0; i < cells; i++) {
        const id = idOut[i];
        if (id !== None)
            ordered[cursor[id]++] = i;
    }
    const slots = new Int32Array(groups);
    const taken = new Int32Array(Slots);
    for (let id = 0; id < groups; id++) {
        for (let s = 0; s < Slots; s++)
            taken[s] = 0;
        const tone = marks[anchors[id]];
        const size = sizes[id];
        for (let k = starts[id]; k < starts[id + 1]; k++) {
            const r = Math.floor(ordered[k] / cols), c = ordered[k] % cols;
            for (let dr = -Apart; dr <= Apart; dr++) {
                const nr = r + dr;
                if (nr < 0 || nr >= rows)
                    continue;
                for (let dc = -Apart; dc <= Apart; dc++) {
                    const nc = c + dc;
                    if (nc < 0 || nc >= cols)
                        continue;
                    const ni = nr * cols + nc;
                    const other = idOut[ni];
                    if (other === None || other >= id)
                        continue;
                    if (marks[ni] !== tone || sizes[other] !== size)
                        continue;
                    const reach = dr < 0 ? -dr : dr;
                    const span = dc < 0 ? -dc : dc;
                    const distance = reach > span ? reach : span;
                    const held = slots[other];
                    if (taken[held] === 0 || distance < taken[held])
                        taken[held] = distance;
                }
            }
        }
        const preferred = anchors[id] % Slots;
        let chosen = -1;
        for (let k = 0; k < Slots; k++) {
            const s = (preferred + k) % Slots;
            if (taken[s] !== 0)
                continue;
            chosen = s;
            break;
        }
        if (chosen < 0) {
            chosen = preferred;
            for (let s = 0; s < Slots; s++)
                if (taken[s] > taken[chosen])
                    chosen = s;
        }
        slots[id] = chosen;
    }
    return slots;
}

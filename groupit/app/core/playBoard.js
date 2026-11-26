import { cellIndex, locksItsCell } from './clue.js';
import { evaluate } from './clueEval.js';
import { Mechanic } from './mechanic.js';
import { Status } from './status.js';
import { Mark, toneToMark } from './types.js';
export class PlayBoard {
    puzzle;
    #marks;
    #locked;
    #undo = [];
    #undoRuns = [];
    #status = new Status();
    #groupAt = null;
    #dirty = true;
    #wrong = false;
    #touching = -1;
    #touchingGroup = null;
    #moves = 0;
    constructor(puzzle) {
        if (puzzle === null || puzzle === undefined)
            throw new Error('puzzle is required');
        this.puzzle = puzzle;
        this.#marks = new Uint8Array(puzzle.cellCount);
        this.#locked = new Uint8Array(puzzle.cellCount);
        for (const clue of puzzle.clues) {
            if (!locksItsCell(clue))
                continue;
            const idx = cellIndex(clue, puzzle.cols);
            if (idx < 0)
                continue;
            this.#marks[idx] = toneToMark(clue.tone);
            this.#locked[idx] = 1;
        }
        if (puzzle.voids !== null)
            for (const cell of puzzle.voids)
                if (cell >= 0 && cell < this.#locked.length)
                    this.#locked[cell] = 1;
        if (puzzle.groups !== null && puzzle.groups.length > 0) {
            const groupAt = new Int32Array(puzzle.cellCount).fill(-1);
            for (let g = 0; g < puzzle.groups.length; g++)
                for (const member of puzzle.groups[g])
                    groupAt[member] = g;
            this.#groupAt = groupAt;
        }
    }
    get rows() { return this.puzzle.rows; }
    get cols() { return this.puzzle.cols; }
    get cellCount() { return this.puzzle.cellCount; }
    get moves() { return this.#moves; }
    get everWrong() { return this.#wrong; }
    get canUndo() { return this.#undo.length > 0; }
    get lastMarked() {
        return this.#undo.length === 0 ? -1 : this.#undo[this.#undo.length - 1] >> 2;
    }
    at(index) { return this.#marks[index]; }
    atRC(row, col) { return this.#marks[row * this.cols + col]; }
    isLocked(index) { return this.#locked[index] !== 0; }
    isLockedRC(row, col) { return this.#locked[row * this.cols + col] !== 0; }
    get status() {
        if (this.#dirty) {
            evaluate(this.puzzle, this.#marks, this.#status);
            this.#dirty = false;
        }
        return this.#status;
    }
    get isSolved() { return this.status.solved; }
    get marks() { return this.#marks; }
    cycle(index) {
        if (index < 0 || index >= this.#marks.length || this.#locked[index] !== 0)
            return false;
        const before = this.#marks[index];
        return this.#set(index, this.#forward(before), before);
    }
    cycleBack(index) {
        if (index < 0 || index >= this.#marks.length || this.#locked[index] !== 0)
            return false;
        const before = this.#marks[index];
        return this.#set(index, this.#backward(before), before);
    }
    #forward(mark) {
        if (this.puzzle.mechanic === Mechanic.GoldHour)
            return mark === Mark.Unknown ? Mark.Shadow
                : mark === Mark.Shadow ? Mark.Light
                    : mark === Mark.Light ? Mark.Gold
                        : Mark.Unknown;
        return mark === Mark.Unknown ? Mark.Shadow
            : mark === Mark.Shadow ? Mark.Light
                : Mark.Unknown;
    }
    #backward(mark) {
        if (this.puzzle.mechanic === Mechanic.GoldHour)
            return mark === Mark.Unknown ? Mark.Gold
                : mark === Mark.Gold ? Mark.Light
                    : mark === Mark.Light ? Mark.Shadow
                        : Mark.Unknown;
        return mark === Mark.Unknown ? Mark.Light
            : mark === Mark.Light ? Mark.Shadow
                : Mark.Unknown;
    }
    isGrouped(index) {
        return this.#groupAt !== null && index >= 0 && index < this.#groupAt.length &&
            this.#groupAt[index] >= 0;
    }
    cycleGroup(index) {
        if (index < 0 || index >= this.#marks.length || this.#locked[index] !== 0)
            return false;
        const g = this.#groupAt !== null ? this.#groupAt[index] : -1;
        if (g < 0)
            return this.cycle(index);
        const members = this.puzzle.groups[g];
        this.#settle(index, members);
        let wrote = this.#advance(index) ? 1 : 0;
        for (const member of members)
            if (member !== index && this.#advance(member))
                wrote++;
        if (wrote === 0)
            return false;
        this.#undoRuns.push(wrote);
        this.#moves++;
        this.#dirty = true;
        return true;
    }
    #advance(index) {
        if (this.#locked[index] !== 0)
            return false;
        const before = this.#marks[index];
        const after = this.#forward(before);
        if (after === before)
            return false;
        this.#undo.push((index << 2) | before);
        this.#marks[index] = after;
        return true;
    }
    put(index, mark) {
        if (index < 0 || index >= this.#marks.length || this.#locked[index] !== 0)
            return false;
        const before = this.#marks[index];
        return this.#set(index, before === mark ? Mark.Unknown : mark, before);
    }
    stroke(index, tone) {
        if (index < 0 || index >= this.#marks.length || this.#locked[index] !== 0)
            return false;
        const before = this.#marks[index];
        return this.#set(index, before === Mark.Unknown ? tone : Mark.Unknown, before);
    }
    #set(index, after, before) {
        if (after === before)
            return false;
        this.#settle(index, null);
        this.#undo.push((index << 2) | before);
        this.#undoRuns.push(1);
        this.#marks[index] = after;
        this.#moves++;
        this.#dirty = true;
        return true;
    }
    #settle(index, group) {
        let staying;
        if (this.#touchingGroup !== null) {
            staying = false;
            for (const member of this.#touchingGroup)
                if (member === index) {
                    staying = true;
                    break;
                }
        }
        else {
            staying = this.#touching === index;
        }
        if (!staying) {
            if (this.#touchingGroup !== null) {
                for (const member of this.#touchingGroup)
                    if (this.#isWrongAt(member)) {
                        this.#wrong = true;
                        break;
                    }
            }
            else if (this.#touching >= 0 && this.#isWrongAt(this.#touching)) {
                this.#wrong = true;
            }
        }
        this.#touching = index;
        this.#touchingGroup = group;
    }
    #isWrongAt(index) {
        if (index < 0 || this.puzzle.solution === null)
            return false;
        const mark = this.#marks[index];
        return mark !== Mark.Unknown && mark !== toneToMark(this.puzzle.solution[index]);
    }
    undo() {
        let cell = -1;
        if (this.#undo.length === 0)
            return { ok: false, cell };
        const run = this.#undoRuns.length > 0 ? this.#undoRuns[this.#undoRuns.length - 1] : 1;
        if (this.#undoRuns.length > 0)
            this.#undoRuns.pop();
        for (let k = 0; k < run && this.#undo.length > 0; k++) {
            const packed = this.#undo.pop();
            cell = packed >> 2;
            this.#marks[cell] = packed & 3;
        }
        this.#dirty = true;
        return { ok: true, cell };
    }
    reset() {
        for (let i = 0; i < this.#marks.length; i++)
            if (this.#locked[i] === 0)
                this.#marks[i] = Mark.Unknown;
        this.#touching = -1;
        this.#touchingGroup = null;
        this.#undo.length = 0;
        this.#undoRuns.length = 0;
        this.#moves = 0;
        this.#dirty = true;
    }
    copyMarksTo(destination) { destination.set(this.#marks); }
}

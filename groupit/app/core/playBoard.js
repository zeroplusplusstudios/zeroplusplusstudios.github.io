// Ported from Assets/_Project/Scripts/Core/Play/PlayBoard.cs
//
// A puzzle a player is currently working on. Owns the marks, the undo history and the live
// verdict; knows nothing about how any of it is drawn.
//
// Cells whose clue states their own tone are LOCKED — the clue hands you that tone, so the cell
// is a given and tapping it is a no-op rather than a mistake to undo. Which kinds those are is
// asked of the clue (locksItsCell) and never listed here: a missed kind does not throw, it
// silently withholds a given the solver, the rating and the hint all believe the player has.
import { cellIndex, locksItsCell } from './clue.js';
import { evaluate } from './clueEval.js';
import { Mechanic } from './mechanic.js';
import { Status } from './status.js';
import { Mark, toneToMark } from './types.js';
export class PlayBoard {
    puzzle;
    #marks;
    #locked;
    /** packed: index << 2 | previousMark */
    #undo = [];
    /**
     * Entry counts, one per move: how many undo entries that move wrote.
     *
     * A gas-line flip changes every member of a group in one gesture, and an undo that gave back
     * one cell of it would leave the group in a state no gesture can produce — so undo works in
     * transactions, and this list is the transaction boundaries. Every single-cell move writes a
     * run of 1, which keeps the two lists in lockstep.
     */
    #undoRuns = [];
    #status = new Status();
    /** Gas-line group per cell (index into puzzle.groups), or -1. Null when there are none. */
    #groupAt = null;
    #dirty = true;
    #wrong = false;
    /** the cell the player's current gesture is on; not yet judged */
    #touching = -1;
    /** the whole group, when that gesture was a gas-line flip */
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
        // A hole is not a cell. It takes no mark, so locking it is how every tap path, the undo
        // stack and the completion count learn that at once rather than one by one.
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
    /** Number of taps made, including ones later undone. A raw effort signal. */
    get moves() { return this.#moves; }
    /**
     * Has a cell ever been *left* in a state the answer disagrees with?
     *
     * "Left", not "passed through", and that word is load-bearing. The cycle is
     * Unknown → Shadow → Light, so reaching a correct Light cell *requires* standing on Shadow for
     * one tap. Counting that as a mistake makes a perfect run impossible on any board with a lit
     * cell in it. A cell only counts as wrong once the player moves to a different cell and leaves
     * it that way — and the cell currently under the finger is deliberately NOT included.
     */
    get everWrong() { return this.#wrong; }
    get canUndo() { return this.#undo.length > 0; }
    /**
     * The cell the player touched most recently, or -1 on an untouched board. Read off the undo
     * trail rather than latched into a field of its own, because the trail is already the
     * authoritative record and a second copy is one more thing Reset and undo must clear.
     */
    get lastMarked() {
        return this.#undo.length === 0 ? -1 : this.#undo[this.#undo.length - 1] >> 2;
    }
    at(index) { return this.#marks[index]; }
    atRC(row, col) { return this.#marks[row * this.cols + col]; }
    isLocked(index) { return this.#locked[index] !== 0; }
    isLockedRC(row, col) { return this.#locked[row * this.cols + col] !== 0; }
    /** The live verdict, recomputed only when something has actually changed. */
    get status() {
        if (this.#dirty) {
            evaluate(this.puzzle, this.#marks, this.#status);
            this.#dirty = false;
        }
        return this.#status;
    }
    get isSolved() { return this.status.solved; }
    /** A read-only view of the marks, for a renderer. Do not mutate. */
    get marks() { return this.#marks; }
    /**
     * Advances one cell: Unknown → Shadow → Light → Unknown, with Gold in the ring after Light on
     * a GoldHour board. Returns false if locked.
     */
    cycle(index) {
        if (index < 0 || index >= this.#marks.length || this.#locked[index] !== 0)
            return false;
        const before = this.#marks[index];
        return this.#set(index, this.#forward(before), before);
    }
    /** Steps backwards through the same ring. For a secondary input. */
    cycleBack(index) {
        if (index < 0 || index >= this.#marks.length || this.#locked[index] !== 0)
            return false;
        const before = this.#marks[index];
        return this.#set(index, this.#backward(before), before);
    }
    /**
     * The tap ring, forwards. Gold joins it only when the puzzle says so: the shipped Mechanic.None
     * boards have a pinned three-state ring that must not move, so the fourth state is a
     * per-puzzle fact rather than a build-wide one.
     */
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
    /** The same ring, walked the other way. */
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
    /** Is this cell a member of a gas-line group? */
    isGrouped(index) {
        return this.#groupAt !== null && index >= 0 && index < this.#groupAt.length &&
            this.#groupAt[index] >= 0;
    }
    /**
     * Cycles every member of the tapped cell's gas-line group, as ONE move. The cells share a
     * feed, so they flip together — and the accounting agrees with it everywhere the gesture is
     * counted: moves goes up once, undo gains one transaction given back whole, and everWrong
     * judges the group as a unit when the finger leaves it.
     *
     * Falls back to cycle on an ungrouped cell, so a caller may route every tap of a gas-line
     * board through here without first asking which cells are plumbed.
     */
    cycleGroup(index) {
        if (index < 0 || index >= this.#marks.length || this.#locked[index] !== 0)
            return false;
        const g = this.#groupAt !== null ? this.#groupAt[index] : -1;
        if (g < 0)
            return this.cycle(index);
        const members = this.puzzle.groups[g];
        // One gesture over many cells: whatever the previous gesture left behind settles now, and
        // the whole group becomes the thing under the finger.
        this.#settle(index, members);
        // The tapped cell's entry goes down first, so undo can name it as the cell that moved.
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
    /** One member's step of a group flip: the mark and its undo entry, nothing else. */
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
    /**
     * Commits one tone outright, or clears the cell if it is already holding that tone.
     *
     * cycle costs two taps to reach Light, which is fine while exploring and expensive once the
     * player knows the answer. Tapping the tone a cell already has clears it rather than doing
     * nothing — without that the gesture has no inverse.
     */
    put(index, mark) {
        if (index < 0 || index >= this.#marks.length || this.#locked[index] !== 0)
            return false;
        const before = this.#marks[index];
        return this.#set(index, before === mark ? Mark.Unknown : mark, before);
    }
    /**
     * The primary gesture: paints an empty cell with `tone`, and clears a cell already holding
     * **any** tone.
     *
     * The difference from put is one word — *any* — and it is the whole point. Put only undoes the
     * tone its own gesture names, so a tap on a cell holding the other tone repaints it; the most
     * common correction in the game would then cost differently depending on which way round you
     * were wrong. One gesture should mean one thing regardless of what is underneath it.
     */
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
    /**
     * Moving to a different cell settles the previous one: whatever it was left holding is now the
     * player's answer for it, and can be judged. A group flip is one gesture over many cells, so
     * the group settles as a unit — the ring passes through Shadow on the way to Light, and a
     * group has to be allowed the same route without the intermediate stop costing the Clean star.
     */
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
    /** Is this cell holding a tone the answer does not have? False for Unknown and for no solution. */
    #isWrongAt(index) {
        if (index < 0 || this.puzzle.solution === null)
            return false;
        const mark = this.#marks[index];
        return mark !== Mark.Unknown && mark !== toneToMark(this.puzzle.solution[index]);
    }
    /**
     * Undo, and say which cell moved. A transaction comes back whole: a gas-line flip went down as
     * one move, and an undo that returned one member would leave the group in a state no gesture
     * produces. The cell reported is the transaction's first entry — the tapped cell, for a group.
     */
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
    /** Back to the printed givens. Clears the undo history — this is not an edit. */
    reset() {
        for (let i = 0; i < this.#marks.length; i++)
            if (this.#locked[i] === 0)
                this.#marks[i] = Mark.Unknown;
        // A latched wrong deliberately survives: wiping the board is a legitimate move, and it costs
        // the third star, but it is not a way to un-make a mistake already left standing. The cell
        // under the finger is NOT settled by a reset — the player is correcting, not moving on.
        this.#touching = -1;
        this.#touchingGroup = null;
        this.#undo.length = 0;
        this.#undoRuns.length = 0;
        this.#moves = 0;
        this.#dirty = true;
    }
    copyMarksTo(destination) { destination.set(this.#marks); }
}
//# sourceMappingURL=playBoard.js.map
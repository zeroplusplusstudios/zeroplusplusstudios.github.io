import { cellIndex, label, locksItsCell, printed } from './clue.js';
import { evaluate, verify } from './clueEval.js';
import { Mechanic } from './mechanic.js';
import { Puzzle } from './puzzle.js';
import * as Regions from './regions.js';
import { Status } from './status.js';
import { ClueKind, Dir, Mark, Tone, markToTone, toneToMark } from './types.js';
export var Technique;
(function (Technique) {
    Technique[Technique["LoneCell"] = 0] = "LoneCell";
    Technique[Technique["SealedRegion"] = 1] = "SealedRegion";
    Technique[Technique["ForcedGrowth"] = 2] = "ForcedGrowth";
    Technique[Technique["SingleRun"] = 3] = "SingleRun";
    Technique[Technique["Alternating"] = 4] = "Alternating";
    Technique[Technique["Envelope"] = 5] = "Envelope";
    Technique[Technique["WouldMerge"] = 6] = "WouldMerge";
    Technique[Technique["LineNarrowing"] = 7] = "LineNarrowing";
    Technique[Technique["TallySpend"] = 8] = "TallySpend";
    Technique[Technique["UnlitResolve"] = 9] = "UnlitResolve";
    Technique[Technique["GroupEcho"] = 10] = "GroupEcho";
    Technique[Technique["CourtyardCorner"] = 11] = "CourtyardCorner";
    Technique[Technique["DuskAvalanche"] = 12] = "DuskAvalanche";
    Technique[Technique["LampReach"] = 13] = "LampReach";
    Technique[Technique["SkyBridge"] = 14] = "SkyBridge";
    Technique[Technique["LanternBudget"] = 15] = "LanternBudget";
    Technique[Technique["GoldWedge"] = 16] = "GoldWedge";
    Technique[Technique["GoldSieve"] = 17] = "GoldSieve";
    Technique[Technique["TripleBreak"] = 18] = "TripleBreak";
    Technique[Technique["TurnstileNarrow"] = 19] = "TurnstileNarrow";
    Technique[Technique["WatchSaturate"] = 20] = "WatchSaturate";
    Technique[Technique["PaneCorner"] = 21] = "PaneCorner";
    Technique[Technique["SizeExclusion"] = 22] = "SizeExclusion";
    Technique[Technique["LongStepSieve"] = 23] = "LongStepSieve";
    Technique[Technique["CrossSpend"] = 24] = "CrossSpend";
    Technique[Technique["CrestCap"] = 25] = "CrestCap";
    Technique[Technique["TwinBound"] = 26] = "TwinBound";
    Technique[Technique["ShoreBounds"] = 27] = "ShoreBounds";
    Technique[Technique["Downstream"] = 28] = "Downstream";
    Technique[Technique["TwiceToldNarrow"] = 29] = "TwiceToldNarrow";
    Technique[Technique["ShapeSieve"] = 30] = "ShapeSieve";
    Technique[Technique["LongStepClear"] = 31] = "LongStepClear";
    Technique[Technique["DegreeSeal"] = 32] = "DegreeSeal";
    Technique[Technique["WeighSplit"] = 33] = "WeighSplit";
    Technique[Technique["SizeQuarrel"] = 34] = "SizeQuarrel";
    Technique[Technique["LightBridge"] = 35] = "LightBridge";
    Technique[Technique["EvenSplitNarrow"] = 36] = "EvenSplitNarrow";
    Technique[Technique["Contradiction"] = 37] = "Contradiction";
    Technique[Technique["Count"] = 38] = "Count";
})(Technique || (Technique = {}));
function step(cell, tone, technique, clueIndex, why) {
    return { cell, tone, technique, clueIndex, why };
}
export var HintKind;
(function (HintKind) {
    HintKind[HintKind["None"] = 0] = "None";
    HintKind[HintKind["Move"] = 1] = "Move";
    HintKind[HintKind["Mistake"] = 2] = "Mistake";
})(HintKind || (HintKind = {}));
function capitalised(text) {
    if (text === null || text === undefined || text.length === 0)
        return text;
    const c = text[0];
    return c !== c.toUpperCase() && c === c.toLowerCase() ? c.toUpperCase() + text.substring(1) : text;
}
export function makeHint(kind, cell, tone, technique, clueIndex, text) {
    return Object.freeze({ kind, cell, tone, technique, clueIndex, text: capitalised(text) });
}
export function hintNothing(text) {
    return makeHint(HintKind.None, -1, Tone.Shadow, Technique.LoneCell, -1, text);
}
export class Ladder {
    solved = false;
    contradiction = false;
    stuck = false;
    marks = new Uint8Array(0);
    trace = [];
    hardest = Technique.LoneCell;
    uses = new Int32Array(Technique.Count);
    rating = 0;
}
export const MaxNarrowingUnknowns = 14;
export const MaxNarrowingGoldUnknowns = 9;
export const DeepShareForHard = 0.45;
const U = Mark.Unknown;
function opposite(t) { return t === Tone.Light ? Tone.Shadow : Tone.Light; }
function name(t) { return t === Tone.Gold ? 'gold' : t === Tone.Light ? 'light' : 'dark'; }
function other(m) { return m === Mark.Light ? Tone.Shadow : Tone.Light; }
function usesSieve(m) {
    return m === Mechanic.Rollcall || m === Mechanic.Silhouette || m === Mechanic.UnlikeNeighbours ||
        m === Mechanic.SecondReading || m === Mechanic.Scales || m === Mechanic.TwiceTold ||
        m === Mechanic.LongStep || m === Mechanic.LikeForLike || m === Mechanic.Shoreline ||
        m === Mechanic.BigHouse;
}
export function tierOf(t) {
    switch (t) {
        case Technique.LoneCell:
        case Technique.SealedRegion: return 0;
        case Technique.ForcedGrowth:
        case Technique.SingleRun:
        case Technique.Alternating:
        case Technique.TallySpend:
        case Technique.EvenSplitNarrow:
        case Technique.CourtyardCorner:
        case Technique.TripleBreak:
        case Technique.PaneCorner:
        case Technique.Downstream:
        case Technique.WeighSplit:
        case Technique.WatchSaturate:
        case Technique.DuskAvalanche: return 1;
        case Technique.Envelope:
        case Technique.WouldMerge:
        case Technique.UnlitResolve:
        case Technique.GroupEcho:
        case Technique.LampReach:
        case Technique.LanternBudget:
        case Technique.SkyBridge:
        case Technique.LightBridge:
        case Technique.TurnstileNarrow:
        case Technique.LongStepClear:
        case Technique.LongStepSieve:
        case Technique.CrossSpend:
        case Technique.CrestCap:
        case Technique.TwinBound:
        case Technique.ShoreBounds:
        case Technique.SizeExclusion:
        case Technique.SizeQuarrel:
        case Technique.DegreeSeal:
        case Technique.ShapeSieve:
        case Technique.GoldWedge: return 2;
        case Technique.LineNarrowing:
        case Technique.TwiceToldNarrow:
        case Technique.GoldSieve: return 3;
        default: return 4;
    }
}
export function isFreeRead(t) {
    return tierOf(t) <= 1 || t === Technique.UnlitResolve;
}
function isDeep(t) {
    return t === Technique.Envelope || t === Technique.WouldMerge;
}
export class LadderSolver {
    _p;
    _clues;
    _rows;
    _cols;
    _cells;
    _nb;
    _regionClueAt;
    _regionClues = [];
    _lineClues = [];
    _lanternClues = [];
    _tallyClues = [];
    _openClues = [];
    _turnsClues = [];
    _rays;
    _groupOf = null;
    _tones;
    _lampCell = null;
    _lamps = null;
    _lampDist = null;
    _lampQueue = null;
    _trial = null;
    _trialStatus = null;
    _advice = new Status();
    _printed;
    _hole;
    _comp = [];
    _env = [];
    _stack = [];
    _seen;
    _label;
    _labelSize = [];
    _labelClue = [];
    _touch = [];
    _found = [];
    _hoodClues = [];
    _crestClues = [];
    _twinClues = [];
    _shoreClues = [];
    _doubleClues = [];
    _degreeClues = [];
    _sieveWorth = null;
    _keepApart;
    _freeOnly;
    _brokenClue = -1;
    _sealedSize = 0;
    _armMin = 0;
    _armMax = 0;
    givenCount = 0;
    constructor(puzzle, keepApart = true, freeReadsOnly = false) {
        if (puzzle === null || puzzle === undefined)
            throw new Error('puzzle is required');
        this._keepApart = keepApart;
        this._freeOnly = freeReadsOnly;
        this._p = puzzle;
        this._clues = puzzle.clues;
        this._rows = puzzle.rows;
        this._cols = puzzle.cols;
        this._cells = this._rows * this._cols;
        const cells = this._cells, cols = this._cols, rows = this._rows;
        const clues = this._clues;
        this._nb = new Int32Array(cells * 4);
        for (let i = 0; i < cells; i++)
            for (let d = 0; d < 4; d++)
                this._nb[i * 4 + d] = puzzle.neighbour(i, d);
        this._seen = new Uint8Array(cells);
        this._label = new Int32Array(cells);
        this._regionClueAt = new Int32Array(cells).fill(-1);
        for (let i = 0; i < clues.length; i++) {
            const clue = clues[i];
            switch (clue.kind) {
                case ClueKind.Region:
                    this._regionClueAt[clue.row * cols + clue.col] = i;
                    this._regionClues.push(i);
                    break;
                case ClueKind.Lantern:
                    this._lanternClues.push(i);
                    break;
                case ClueKind.Tally:
                    this._tallyClues.push(i);
                    break;
                case ClueKind.Open:
                    this._openClues.push(i);
                    break;
                case ClueKind.Line:
                    this._lineClues.push(i);
                    break;
                case ClueKind.Turns:
                    this._turnsClues.push(i);
                    break;
                case ClueKind.Watch:
                case ClueKind.Knight:
                case ClueKind.Cross:
                    this._hoodClues.push(i);
                    break;
                case ClueKind.Crest:
                    this._crestClues.push(i);
                    break;
                case ClueKind.Twin:
                    this._twinClues.push(i);
                    break;
                case ClueKind.Shore:
                    this._shoreClues.push(i);
                    break;
                case ClueKind.Double:
                    this._doubleClues.push(i);
                    break;
            }
        }
        if (puzzle.mechanic === Mechanic.SecondReading) {
            for (const ci of this._regionClues)
                if (clues[ci].tone === Tone.Shadow)
                    this._degreeClues.push(ci);
            for (const ci of this._degreeClues) {
                this._regionClueAt[cellIndex(clues[ci], cols)] = -1;
                const k = this._regionClues.indexOf(ci);
                if (k >= 0)
                    this._regionClues.splice(k, 1);
            }
        }
        this._hole = new Uint8Array(cells);
        if (puzzle.voids !== null)
            for (const cell of puzzle.voids)
                if (cell >= 0 && cell < cells)
                    this._hole[cell] = 1;
        this._printed = new Uint8Array(cells);
        for (const ci of this._regionClues)
            this._printed[cellIndex(clues[ci], cols)] = 1;
        for (const ci of this._lanternClues)
            this._printed[cellIndex(clues[ci], cols)] = 1;
        for (const ci of this._degreeClues)
            this._printed[cellIndex(clues[ci], cols)] = 1;
        for (const ci of this._crestClues)
            this._printed[cellIndex(clues[ci], cols)] = 1;
        for (const ci of this._shoreClues)
            this._printed[cellIndex(clues[ci], cols)] = 1;
        for (const ci of this._hoodClues)
            if (locksItsCell(clues[ci]))
                this._printed[cellIndex(clues[ci], cols)] = 1;
        this._rays = new Array(clues.length).fill(null);
        for (const ci of this._turnsClues) {
            const clue = clues[ci];
            const horizontal = clue.col < 0;
            const length = horizontal ? cols : rows;
            const line = new Array(length);
            for (let k = 0; k < length; k++)
                line[k] = horizontal ? clue.row * cols + k : k * cols + clue.col;
            this._rays[ci] = line;
        }
        for (const ci of this._doubleClues) {
            const clue = clues[ci];
            const { horizontal, lo, hi } = Regions.lineRange(clue.dir, clue.row, clue.col, rows, cols);
            const ray = new Array(hi - lo + 1);
            for (let k = lo; k <= hi; k++)
                ray[k - lo] = horizontal ? clue.row * cols + k : k * cols + clue.col;
            this._rays[ci] = ray;
        }
        for (const ci of this._lineClues) {
            const clue = clues[ci];
            const { horizontal, lo, hi } = Regions.lineRange(clue.dir, clue.row, clue.col, rows, cols);
            const ray = new Array(hi - lo + 1);
            for (let k = lo; k <= hi; k++)
                ray[k - lo] = horizontal ? clue.row * cols + k : k * cols + clue.col;
            this._rays[ci] = ray;
        }
        this._tones = puzzle.mechanic === Mechanic.GoldHour ? 3 : 2;
        if (puzzle.groups !== null && puzzle.groups.length > 0) {
            this._groupOf = new Int32Array(cells).fill(-1);
            for (let g = 0; g < puzzle.groups.length; g++)
                for (const cell of puzzle.groups[g])
                    this._groupOf[cell] = g;
        }
        if (puzzle.mechanic === Mechanic.LanternReach) {
            this._lampCell = new Uint8Array(cells);
            for (const ci of this._lanternClues) {
                const clue = clues[ci];
                for (let c = 0; c < cols; c++)
                    this._lampCell[clue.row * cols + c] = 1;
                for (let r = 0; r < rows; r++)
                    this._lampCell[r * cols + clue.col] = 1;
            }
        }
        if (puzzle.mechanic === Mechanic.StrayLight) {
            this._lamps = [];
            for (const ci of this._regionClues)
                if (clues[ci].tone === Tone.Light)
                    this._lamps.push(ci);
            this._lampDist = new Int32Array(this._lamps.length * cells);
            this._lampQueue = new Int32Array(cells);
        }
        const mech = puzzle.mechanic;
        if (mech === Mechanic.GasLine || mech === Mechanic.LanternReach ||
            mech === Mechanic.OneSky || mech === Mechanic.AllOneColour ||
            mech === Mechanic.GoldHour || usesSieve(mech)) {
            this._trial = new Uint8Array(cells);
            this._trialStatus = new Status();
            this._sieveWorth = new Uint8Array(cells);
        }
    }
    givens() {
        const m = new Uint8Array(this._cells);
        let given = 0;
        for (const clue of this._clues) {
            if (!locksItsCell(clue))
                continue;
            const idx = cellIndex(clue, this._cols);
            if (idx < 0)
                continue;
            if (m[idx] === U)
                given++;
            m[idx] = toneToMark(clue.tone);
        }
        this.givenCount = given;
        this.sealVoids(m);
        return m;
    }
    sealVoids(m) {
        const voids = this._p.voids;
        if (voids === null)
            return;
        for (const cell of voids)
            if (cell >= 0 && cell < this._cells)
                m[cell] = Mark.Shadow;
    }
    solve(seed = null, allowContradiction = true) {
        const result = new Ladder();
        const m = seed === null ? this.givens() : seed.slice();
        this.sealVoids(m);
        result.marks = m;
        const cells = this._cells;
        const found = this._found;
        while (true) {
            let unknown = 0;
            for (let i = 0; i < cells; i++)
                if (m[i] === U)
                    unknown++;
            if (unknown === 0)
                break;
            found.length = 0;
            const broke = this.findEasiest(m, found, allowContradiction);
            if (broke) {
                result.contradiction = true;
                return this.rate(result);
            }
            if (found.length === 0) {
                result.stuck = true;
                return this.rate(result);
            }
            for (let s = 0; s < found.length; s++) {
                const st = found[s];
                const want = toneToMark(st.tone);
                if (m[st.cell] !== U && m[st.cell] !== want) {
                    result.contradiction = true;
                    return this.rate(result);
                }
                if (m[st.cell] === want)
                    continue;
                m[st.cell] = want;
                result.trace.push(st);
                result.uses[st.technique]++;
                if (st.technique > result.hardest)
                    result.hardest = st.technique;
                const g = this._groupOf === null ? -1 : this._groupOf[st.cell];
                if (g >= 0) {
                    for (const member of this._p.groups[g]) {
                        if (m[member] === want)
                            continue;
                        if (m[member] !== U) {
                            result.contradiction = true;
                            return this.rate(result);
                        }
                        m[member] = want;
                        result.trace.push(step(member, st.tone, st.technique, st.clueIndex, st.why));
                        result.uses[st.technique]++;
                    }
                }
            }
        }
        const grid = new Uint8Array(cells);
        for (let i = 0; i < cells; i++)
            grid[i] = markToTone(m[i]);
        if (verify(this._p, grid))
            result.solved = true;
        else
            result.contradiction = true;
        return this.rate(result);
    }
    advise(marks, lastMarked = -1) {
        const cells = this._cells;
        if (marks === null || marks === undefined || marks.length !== cells)
            throw new Error('marks must be rows*cols');
        if (this._p.voids !== null) {
            marks = marks.slice();
            this.sealVoids(marks);
        }
        let anyUnknown = false;
        for (let i = 0; i < cells; i++)
            if (marks[i] === U) {
                anyUnknown = true;
                break;
            }
        if (!anyUnknown) {
            const grid = new Uint8Array(cells);
            for (let i = 0; i < cells; i++)
                grid[i] = markToTone(marks[i]);
            return verify(this._p, grid)
                ? hintNothing('Every cell is placed and every clue holds. This one is done.')
                : this.mistake(marks, lastMarked);
        }
        evaluate(this._p, marks, this._advice);
        if (this._advice.brokenClueCount > 0 || this._advice.brokenLawCount > 0)
            return this.mistake(marks, lastMarked);
        const wrong = this.disagreeing(marks, lastMarked);
        if (wrong >= 0)
            return makeHint(HintKind.Mistake, wrong, Tone.Shadow, Technique.LoneCell, -1, 'This mark cannot be right. Take it back and look again.');
        const work = marks.slice();
        const found = this._found;
        found.length = 0;
        if (this.findEasiest(work, found, true))
            return this.mistake(marks, lastMarked);
        if (found.length === 0)
            return hintNothing('No single step follows from what is on the board yet — try another corner.');
        const st = found[0];
        return makeHint(HintKind.Move, st.cell, st.tone, st.technique, st.clueIndex, st.why);
    }
    mistake(marks, lastMarked) {
        evaluate(this._p, marks, this._advice);
        const clueBroken = this._advice.clueBroken;
        for (let i = 0; i < clueBroken.length; i++) {
            if (clueBroken[i] === 0)
                continue;
            const blame = this.blame(marks, lastMarked);
            return blame >= 0
                ? makeHint(HintKind.Mistake, blame, Tone.Shadow, Technique.LoneCell, i, 'This mark is what breaks that clue. Take it back and look again.')
                : makeHint(HintKind.Mistake, cellIndex(this._clues[i], this._cols), Tone.Shadow, Technique.LoneCell, i, 'This clue can no longer come true. Something around it has to change.');
        }
        if (this._p.solution !== null) {
            const first = this.disagreeing(marks, lastMarked);
            if (first >= 0)
                return makeHint(HintKind.Mistake, first, Tone.Shadow, Technique.LoneCell, -1, 'This cell is the one that cannot work. Clear it and look again.');
        }
        return hintNothing('Something already placed rules out every ending, but no single clue shows it yet.');
    }
    disagreeing(marks, lastMarked) {
        const solution = this._p.solution;
        if (solution === null)
            return -1;
        let first = -1;
        for (let i = 0; i < this._cells; i++) {
            if (this._printed[i] !== 0 || this._hole[i] !== 0)
                continue;
            if (marks[i] === U || markToTone(marks[i]) === solution[i])
                continue;
            if (i === lastMarked)
                return i;
            if (first < 0)
                first = i;
        }
        return first;
    }
    blame(marks, lastMarked) {
        const cellBroken = this._advice.cellBroken;
        const editable = (i) => i >= 0 && i < this._cells && cellBroken[i] !== 0 && this._printed[i] === 0 && marks[i] !== U;
        if (editable(lastMarked))
            return lastMarked;
        for (let i = 0; i < this._cells; i++)
            if (editable(i))
                return i;
        return -1;
    }
    findEasiest(m, found, allowContradiction) {
        const twoTone = this._tones === 2;
        if (twoTone && this.loneCell(m, found))
            return true;
        if (found.length > 0)
            return false;
        if (twoTone && this.sealedRegion(m, found))
            return true;
        if (found.length > 0)
            return false;
        if (this.forcedGrowth(m, found))
            return true;
        if (found.length > 0)
            return false;
        if (this.singleRun(m, found))
            return true;
        if (found.length > 0)
            return false;
        if (twoTone && this.alternating(m, found))
            return true;
        if (found.length > 0)
            return false;
        if (this.may(Technique.Envelope) && this.envelope(m, found))
            return true;
        if (found.length > 0)
            return false;
        if (twoTone && this._keepApart && this.may(Technique.WouldMerge) && this.wouldMerge(m, found))
            return true;
        if (found.length > 0)
            return false;
        if (this.may(Technique.LineNarrowing) && this.lineNarrowing(m, found))
            return true;
        if (found.length > 0)
            return false;
        const freeOnly = this._freeOnly;
        switch (this._p.mechanic) {
            case Mechanic.Ledger:
                if (this.tallySpend(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.Turnstile:
                if (this.may(Technique.TurnstileNarrow) && this.turnstileNarrow(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.NeverThree:
                if (this.tripleBreak(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.UnlitNumeral:
                if (this.unlitResolve(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.GasLine:
                if (this.may(Technique.GroupEcho) && this.groupEcho(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.NoFullCourtyard:
                if (this.courtyardCorner(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.Duskfall:
                if (this.duskAvalanche(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.StrayLight:
                if (this.may(Technique.LampReach) && this.lampReach(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.LanternReach:
                if (this.may(Technique.LanternBudget) && this.lanternBudget(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                if (!freeOnly && this.lanternSieve(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.OneSky:
                if (this.may(Technique.SkyBridge) && this.skyBridge(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.GoldHour:
                if (this.may(Technique.GoldWedge) && this.goldWedge(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                if (this.may(Technique.GoldSieve) && this.goldSieve(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.Watch:
                if (this.watchSaturate(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.Windowlight:
                if (this.paneCorner(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.Rollcall:
                if (!freeOnly && this.comparisonSieve(m, found, Technique.SizeExclusion, 'the patch it closes is a size this tone has already used'))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.LongStep:
                if (this.may(Technique.LongStepSieve) && this.longStepSaturate(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                if (!freeOnly && this.longStepSieveArm(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.Crossroads:
                if (this.may(Technique.CrossSpend) && this.crossSpend(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.BigHouse:
                if (this.may(Technique.CrestCap) && this.crestCap(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                if (!freeOnly && this.crestSieve(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.LikeForLike:
                if (this.may(Technique.TwinBound) && this.twinBound(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                if (!freeOnly && this.twinSieve(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.Shoreline:
                if (this.may(Technique.ShoreBounds) && this.shoreBounds(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                if (!freeOnly && this.shoreSieve(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.Weir:
                if (this.downstream(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.TwiceTold:
                if (this.may(Technique.TwiceToldNarrow) && this.twiceToldNarrow(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.Silhouette:
                if (!freeOnly && this.comparisonSieve(m, found, Technique.ShapeSieve, 'it closes a lit patch shaped exactly like one already finished'))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.NeverTheLongStep:
                if (this.may(Technique.LongStepClear) && this.longStepClear(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.SecondReading:
                if (this.may(Technique.DegreeSeal) && this.degreeSeal(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.Scales:
                if (this.weighSplit(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                if (!freeOnly && this.comparisonSieve(m, found, Technique.WeighSplit, 'the patch a chevron calls heavier stops being the larger of the two'))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.UnlikeNeighbours:
                if (this.may(Technique.SizeQuarrel) && this.sizeQuarrel(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                if (!freeOnly && this.comparisonSieve(m, found, Technique.SizeQuarrel, 'it closes a patch the same size as one it touches'))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.AllOneColour:
                if (this.may(Technique.LightBridge) && this.lightBridge(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
            case Mechanic.EvenSplit:
                if (this.evenSplitNarrow(m, found))
                    return true;
                if (found.length > 0)
                    return false;
                break;
        }
        if (allowContradiction && this.may(Technique.Contradiction) && this.contradiction(m, found))
            return true;
        return false;
    }
    loneCell(m, found) {
        const nb = this._nb;
        for (const ci of this._regionClues) {
            const clue = this._clues[ci];
            if (clue.value !== 1)
                continue;
            const idx = clue.row * this._cols + clue.col;
            const want = toneToMark(clue.tone);
            if (m[idx] !== want)
                return true;
            const oth = opposite(clue.tone);
            for (let d = 0; d < 4; d++) {
                const n = nb[idx * 4 + d];
                if (n < 0)
                    continue;
                if (m[n] !== U)
                    continue;
                found.push(step(n, oth, Technique.LoneCell, ci, `The ${name(clue.tone)} cell beside it is a group of 1, so nothing touching it can be ${name(clue.tone)} too.`));
            }
        }
        return false;
    }
    sealedRegion(m, found) {
        const nb = this._nb;
        for (const ci of this._regionClues) {
            const clue = this._clues[ci];
            if (clue.value === 1)
                continue;
            const idx = clue.row * this._cols + clue.col;
            const want = toneToMark(clue.tone);
            if (m[idx] !== want)
                return true;
            this.collectComponent(m, idx, want);
            if (this._comp.length > clue.value)
                return true;
            if (this._comp.length !== clue.value)
                continue;
            const oth = opposite(clue.tone);
            for (const cell of this._comp) {
                for (let d = 0; d < 4; d++) {
                    const n = nb[cell * 4 + d];
                    if (n < 0)
                        continue;
                    if (m[n] !== U)
                        continue;
                    found.push(step(n, oth, Technique.SealedRegion, ci, `That ${name(clue.tone)} group already has all ${clue.value} of its cells, so nothing else can join it.`));
                }
            }
        }
        return false;
    }
    forcedGrowth(m, found) {
        const nb = this._nb, seen = this._seen;
        for (const ci of this._regionClues) {
            const clue = this._clues[ci];
            const idx = clue.row * this._cols + clue.col;
            const want = toneToMark(clue.tone);
            if (m[idx] !== want)
                return true;
            this.collectComponent(m, idx, want);
            const size = this._comp.length;
            if (size >= clue.value)
                continue;
            let only = -1;
            let frontier = 0;
            for (const cell of this._comp) {
                for (let d = 0; d < 4; d++) {
                    const n = nb[cell * 4 + d];
                    if (n < 0)
                        continue;
                    if (m[n] !== U || seen[n] !== 0)
                        continue;
                    seen[n] = 1;
                    frontier++;
                    only = n;
                }
            }
            for (const cell of this._comp)
                for (let d = 0; d < 4; d++) {
                    const n = nb[cell * 4 + d];
                    if (n >= 0)
                        seen[n] = 0;
                }
            if (frontier === 0)
                return true;
            if (frontier !== 1)
                continue;
            found.push(step(only, clue.tone, Technique.ForcedGrowth, ci, `That ${name(clue.tone)} group has ${size} of its ${clue.value} cells and only one way left to grow.`));
        }
        return false;
    }
    envelope(m, found) {
        for (const ci of this._regionClues) {
            const clue = this._clues[ci];
            const idx = clue.row * this._cols + clue.col;
            const want = toneToMark(clue.tone);
            if (m[idx] !== want)
                return true;
            const reach = this.collectEnvelope(m, idx, want, -1);
            if (reach < clue.value)
                return true;
            if (reach === clue.value) {
                for (const cell of this._env) {
                    if (m[cell] !== U)
                        continue;
                    found.push(step(cell, clue.tone, Technique.Envelope, ci, `That group needs ${clue.value} cells and can only ever reach ${reach}, so every one of them is ${name(clue.tone)}.`));
                }
                continue;
            }
            const candidates = this._env.slice();
            for (const cell of candidates) {
                if (m[cell] !== U)
                    continue;
                if (this.collectEnvelope(m, idx, want, cell) >= clue.value)
                    continue;
                found.push(step(cell, clue.tone, Technique.Envelope, ci, `Without this cell that group can no longer reach the ${clue.value} it needs.`));
            }
            if (found.length > 0)
                return false;
        }
        return false;
    }
    wouldMerge(m, found) {
        this.labelComponents(m);
        const nb = this._nb, touch = this._touch;
        for (let u = 0; u < this._cells; u++) {
            if (m[u] !== U)
                continue;
            for (let t = 0; t < 2; t++) {
                const tone = t === 0 ? Tone.Shadow : Tone.Light;
                const want = toneToMark(tone);
                touch.length = 0;
                for (let d = 0; d < 4; d++) {
                    const n = nb[u * 4 + d];
                    if (n < 0)
                        continue;
                    if (m[n] !== want)
                        continue;
                    const id = this._label[n];
                    if (!touch.includes(id))
                        touch.push(id);
                }
                if (touch.length < 2)
                    continue;
                let total = 1;
                let target = -1, targetClue = -1, clash = -1;
                for (const id of touch) {
                    total += this._labelSize[id];
                    const ci = this._labelClue[id];
                    if (ci < 0)
                        continue;
                    const value = this._clues[ci].value;
                    if (target < 0) {
                        target = value;
                        targetClue = ci;
                    }
                    else if (value !== target)
                        clash = ci;
                }
                if (clash >= 0) {
                    found.push(step(u, opposite(tone), Technique.WouldMerge, targetClue, `${name(tone)} here would fuse two groups whose clues say ${target} and ${this._clues[clash].value} — one group cannot be both.`));
                    return false;
                }
                if (target >= 0 && total > target) {
                    found.push(step(u, opposite(tone), Technique.WouldMerge, targetClue, `${name(tone)} here would join those ${name(tone)} groups into one of at least ${total}, past the ${target} the clue allows.`));
                    return false;
                }
            }
        }
        return false;
    }
    singleRun(m, found) {
        for (const ci of this._lineClues) {
            const clue = this._clues[ci];
            if (clue.value !== 1)
                continue;
            const ray = this._rays[ci];
            let tone = U;
            for (const cell of ray) {
                if (m[cell] === U)
                    continue;
                if (tone === U)
                    tone = m[cell];
                else if (m[cell] !== tone)
                    return true;
            }
            if (tone === U)
                continue;
            for (const cell of ray) {
                if (m[cell] !== U)
                    continue;
                found.push(step(cell, markToTone(tone), Technique.SingleRun, ci, `That clue shows ${printed(clue)}, so the colour never changes along it — the whole line is one colour, and part of it is already ${name(markToTone(tone))}.`));
            }
        }
        return false;
    }
    alternating(m, found) {
        for (const ci of this._lineClues) {
            const clue = this._clues[ci];
            const ray = this._rays[ci];
            if (clue.value !== ray.length)
                continue;
            let anchor = -1;
            for (let k = 0; k < ray.length; k++)
                if (m[ray[k]] !== U) {
                    anchor = k;
                    break;
                }
            if (anchor < 0)
                continue;
            const at = markToTone(m[ray[anchor]]);
            for (let k = 0; k < ray.length; k++) {
                const want = ((k - anchor) & 1) === 0 ? at : opposite(at);
                if (m[ray[k]] === U) {
                    found.push(step(ray[k], want, Technique.Alternating, ci, `That clue counts ${printed(clue)} changes across ${ray.length} cells, so the colour has to change at every single step.`));
                }
                else if (markToTone(m[ray[k]]) !== want) {
                    return true;
                }
            }
        }
        return false;
    }
    _narrowSlot = [];
    _narrowTone = [];
    narrow(m, ray, value) {
        const tones = this._tones;
        const cap = tones === 2 ? MaxNarrowingUnknowns : MaxNarrowingGoldUnknowns;
        const len = ray.length;
        let unknowns = 0;
        for (let k = 0; k < len; k++)
            if (m[ray[k]] === U)
                unknowns++;
        if (unknowns === 0 || unknowns > cap)
            return 0;
        const slot = new Array(unknowns);
        let s = 0;
        for (let k = 0; k < len; k++)
            if (m[ray[k]] === U)
                slot[s++] = k;
        const saw = new Array(tones).fill(0);
        let valid = 0;
        const line = new Uint8Array(len);
        for (let k = 0; k < len; k++)
            if (m[ray[k]] !== U)
                line[k] = markToTone(m[ray[k]]);
        let combos = 1;
        for (let b = 0; b < unknowns; b++)
            combos *= tones;
        for (let mask = 0; mask < combos; mask++) {
            let v = mask;
            for (let b = 0; b < unknowns; b++) {
                line[slot[b]] = v % tones;
                v = Math.floor(v / tones);
            }
            let runs = 1;
            for (let k = 1; k < len; k++)
                if (line[k] !== line[k - 1])
                    runs++;
            if (runs !== value)
                continue;
            valid++;
            for (let b = 0; b < unknowns; b++)
                saw[line[slot[b]]] |= 1 << b;
        }
        if (valid === 0)
            return -1;
        this._narrowSlot = slot;
        this._narrowTone = new Array(unknowns);
        for (let b = 0; b < unknowns; b++) {
            let seenTones = 0;
            let tone = Tone.Shadow;
            for (let t = 0; t < tones; t++)
                if ((saw[t] & (1 << b)) !== 0) {
                    seenTones++;
                    tone = t;
                }
            this._narrowTone[b] = seenTones === 1 ? tone : -1;
        }
        return 1;
    }
    lineNarrowing(m, found) {
        for (const ci of this._lineClues) {
            const clue = this._clues[ci];
            const ray = this._rays[ci];
            const r = this.narrow(m, ray, clue.value);
            if (r === 0)
                continue;
            if (r < 0)
                return true;
            const pr = printed(clue);
            for (let b = 0; b < this._narrowSlot.length; b++) {
                const tone = this._narrowTone[b];
                if (tone < 0)
                    continue;
                found.push(step(ray[this._narrowSlot[b]], tone, Technique.LineNarrowing, ci, `Every way of making that line change colour ${pr} time${pr === 1 ? '' : 's'} puts ${name(tone)} here.`));
            }
            if (found.length > 0)
                return false;
        }
        return false;
    }
    turnstileNarrow(m, found) {
        for (const ci of this._turnsClues) {
            const clue = this._clues[ci];
            const ray = this._rays[ci];
            const lineName = clue.col < 0 ? 'row' : 'column';
            const r = this.narrow(m, ray, clue.value);
            if (r === 0)
                continue;
            if (r < 0)
                return true;
            const pr = printed(clue);
            for (let b = 0; b < this._narrowSlot.length; b++) {
                const t = this._narrowTone[b];
                if (t < 0)
                    continue;
                const tone = t;
                const why = pr === 0
                    ? `That ${lineName}'s 0 says it never turns, so the whole ${lineName} is one tone — ${name(tone)}.`
                    : `Every way that ${lineName} can turn ${pr} time${pr === 1 ? '' : 's'} puts ${name(tone)} here.`;
                found.push(step(ray[this._narrowSlot[b]], tone, Technique.TurnstileNarrow, ci, why));
            }
            if (found.length > 0)
                return false;
        }
        return false;
    }
    tripleBreak(m, found) {
        if (this._tones !== 2)
            return false;
        const rows = this._rows, cols = this._cols;
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++) {
                for (let axis = 0; axis < 2; axis++) {
                    const stp = axis === 0 ? 1 : cols;
                    const limit = axis === 0 ? cols - c : rows - r;
                    if (limit < 3)
                        continue;
                    const i = r * cols + c;
                    const a = m[i], b = m[i + stp], d = m[i + 2 * stp];
                    if (a !== U && a === b && d === U) {
                        found.push(step(i + 2 * stp, other(a), Technique.TripleBreak, -1, `Two ${name(markToTone(a))} already sit together there, and no three in a line may match — so this one is ${name(other(a))}.`));
                    }
                    else if (d !== U && d === b && a === U) {
                        found.push(step(i, other(d), Technique.TripleBreak, -1, `Two ${name(markToTone(d))} already sit together there, and no three in a line may match — so this one is ${name(other(d))}.`));
                    }
                    else if (a !== U && a === d && b === U) {
                        found.push(step(i + stp, other(a), Technique.TripleBreak, -1, `Filling that gap with ${name(markToTone(a))} would make three in a line, so it is ${name(other(a))}.`));
                    }
                }
            }
        return false;
    }
    tallySpend(m, found) {
        const cols = this._cols;
        for (const ci of this._tallyClues) {
            const clue = this._clues[ci];
            const isRow = clue.col < 0;
            const lineName = isRow ? 'row' : 'column';
            const n = isRow ? cols : this._rows;
            let lit = 0, unknown = 0;
            for (let k = 0; k < n; k++) {
                const mk = m[isRow ? clue.row * cols + k : k * cols + clue.col];
                if (mk === Mark.Light)
                    lit++;
                else if (mk === U)
                    unknown++;
            }
            if (lit > clue.value || lit + unknown < clue.value)
                return true;
            if (unknown === 0)
                continue;
            if (lit === clue.value) {
                for (let k = 0; k < n; k++) {
                    const idx = isRow ? clue.row * cols + k : k * cols + clue.col;
                    if (m[idx] !== U)
                        continue;
                    found.push(step(idx, Tone.Shadow, Technique.TallySpend, ci, `That ${lineName}'s tally of ${printed(clue)} is already met, so everything still open in it is dark.`));
                }
            }
            else if (lit + unknown === clue.value) {
                for (let k = 0; k < n; k++) {
                    const idx = isRow ? clue.row * cols + k : k * cols + clue.col;
                    if (m[idx] !== U)
                        continue;
                    found.push(step(idx, Tone.Light, Technique.TallySpend, ci, `That ${lineName} can only reach its tally of ${printed(clue)} if every open cell in it is light.`));
                }
            }
        }
        return false;
    }
    unlitResolve(m, found) {
        const nb = this._nb, seen = this._seen;
        let labelled = false;
        for (const ci of this._openClues) {
            const clue = this._clues[ci];
            const idx = clue.row * this._cols + clue.col;
            const pr = printed(clue);
            if (m[idx] === U) {
                if (!labelled) {
                    this.labelComponents(m);
                    labelled = true;
                }
                let alive = 0;
                let only = Tone.Shadow;
                for (let t = 0; t < this._tones; t++) {
                    if (!this.poolCanHold(m, idx, t, clue.value))
                        continue;
                    alive++;
                    only = t;
                }
                if (alive === 0)
                    return true;
                if (alive === 1)
                    found.push(step(idx, only, Technique.UnlitResolve, ci, `Only ${name(only)} gives this numeral a group of exactly ${pr} to live in.`));
                continue;
            }
            const want = m[idx];
            const tone = markToTone(want);
            this.collectComponent(m, idx, want);
            const size = this._comp.length;
            if (size > clue.value)
                return true;
            if (size === clue.value) {
                const oth = opposite(tone);
                for (const cell of this._comp)
                    for (let d = 0; d < 4; d++) {
                        const n = nb[cell * 4 + d];
                        if (n < 0)
                            continue;
                        if (m[n] !== U)
                            continue;
                        found.push(step(n, oth, Technique.UnlitResolve, ci, `The group holding that ${pr} already has all ${pr} of its cells, so nothing else can join it.`));
                    }
                continue;
            }
            let onlyOut = -1, frontier = 0;
            for (const cell of this._comp)
                for (let d = 0; d < 4; d++) {
                    const n = nb[cell * 4 + d];
                    if (n < 0)
                        continue;
                    if (m[n] !== U || seen[n] !== 0)
                        continue;
                    seen[n] = 1;
                    frontier++;
                    onlyOut = n;
                }
            for (const cell of this._comp)
                for (let d = 0; d < 4; d++) {
                    const n = nb[cell * 4 + d];
                    if (n >= 0)
                        seen[n] = 0;
                }
            if (frontier === 0)
                return true;
            if (frontier === 1)
                found.push(step(onlyOut, tone, Technique.UnlitResolve, ci, `The group holding that ${pr} has ${size} of its ${pr} cells and only one way left to grow.`));
        }
        return false;
    }
    poolCanHold(m, idx, tone, target) {
        const want = toneToMark(tone);
        const nb = this._nb, touch = this._touch;
        let already = 1;
        touch.length = 0;
        for (let d = 0; d < 4; d++) {
            const n = nb[idx * 4 + d];
            if (n < 0)
                continue;
            if (m[n] !== want)
                continue;
            const id = this._label[n];
            if (touch.includes(id))
                continue;
            touch.push(id);
            already += this._labelSize[id];
            const rc = this._labelClue[id];
            if (rc >= 0 && this._clues[rc].value !== target)
                return false;
        }
        if (already > target)
            return false;
        return this.collectEnvelope(m, idx, want, -1) >= target;
    }
    groupEcho(m, found) {
        const groups = this._p.groups;
        if (groups === null)
            return false;
        for (let g = 0; g < groups.length; g++) {
            for (const cell of groups[g]) {
                if (m[cell] !== U)
                    continue;
                const shadowBreaks = this.toneBreaks(m, cell, Tone.Shadow);
                const shadowClue = this._brokenClue;
                const lightBreaks = this.toneBreaks(m, cell, Tone.Light);
                const lightClue = this._brokenClue;
                if (shadowBreaks && lightBreaks)
                    return true;
                if (!shadowBreaks && !lightBreaks)
                    continue;
                const good = shadowBreaks ? Tone.Light : Tone.Shadow;
                const bad = opposite(good);
                const bc = shadowBreaks ? shadowClue : lightClue;
                const why = bc >= 0
                    ? `Make this ${name(bad)} and its whole gas line follows — and the clue showing ${printed(this._clues[bc])} breaks. So it is ${name(good)}.`
                    : `Make this ${name(bad)} and its gas line would have to disagree with itself — linked cells share one tone, so it is ${name(good)}.`;
                found.push(step(cell, good, Technique.GroupEcho, bc, why));
                return false;
            }
        }
        return false;
    }
    courtyardCorner(m, found) {
        const rows = this._rows, cols = this._cols;
        for (let r = 0; r + 1 < rows; r++) {
            for (let c = 0; c + 1 < cols; c++) {
                const a = r * cols + c;
                let tone = U;
                let open = -1, unknowns = 0;
                let mixed = false;
                for (let k = 0; k < 4; k++) {
                    const cell = a + (k & 1) + (k >> 1) * cols;
                    const mk = m[cell];
                    if (mk === U) {
                        unknowns++;
                        open = cell;
                        continue;
                    }
                    if (tone === U)
                        tone = mk;
                    else if (mk !== tone) {
                        mixed = true;
                        break;
                    }
                }
                if (mixed || unknowns > 1)
                    continue;
                if (unknowns === 0)
                    return true;
                const t = markToTone(tone);
                found.push(step(open, opposite(t), Technique.CourtyardCorner, -1, `Three corners of this courtyard are already ${name(t)}, and no courtyard fills with a single colour — so the last corner is ${name(opposite(t))}.`));
            }
        }
        return false;
    }
    duskAvalanche(m, found) {
        const rows = this._rows, cols = this._cols;
        for (let c = 0; c < cols; c++) {
            let firstLight = -1;
            let lastShadow = -1;
            for (let r = 0; r < rows; r++) {
                const mk = m[r * cols + c];
                if (mk === Mark.Light && firstLight < 0)
                    firstLight = r;
                if (mk === Mark.Shadow)
                    lastShadow = r;
            }
            if (firstLight >= 0 && lastShadow > firstLight)
                return true;
            if (firstLight >= 0) {
                for (let r = firstLight + 1; r < rows; r++) {
                    if (m[r * cols + c] !== U)
                        continue;
                    found.push(step(r * cols + c, Tone.Light, Technique.DuskAvalanche, -1, 'Dusk never leaves light hanging above dark, so everything below a lit cell stays light.'));
                }
            }
            if (lastShadow >= 0) {
                for (let r = 0; r < lastShadow; r++) {
                    if (m[r * cols + c] !== U)
                        continue;
                    found.push(step(r * cols + c, Tone.Shadow, Technique.DuskAvalanche, -1, 'Dusk falls from the top of the sky, so everything above a dark cell is dark too.'));
                }
            }
        }
        return false;
    }
    lanternSieve(m, found) {
        const lampCell = this._lampCell;
        for (let u = 0; u < this._cells; u++) {
            if (m[u] !== U || lampCell[u] === 0)
                continue;
            const shadowBreaks = this.toneBreaks(m, u, Tone.Shadow);
            const shadowClue = this._brokenClue;
            const lightBreaks = this.toneBreaks(m, u, Tone.Light);
            const lightClue = this._brokenClue;
            if (shadowBreaks && lightBreaks)
                return true;
            if (!shadowBreaks && !lightBreaks)
                continue;
            const good = shadowBreaks ? Tone.Light : Tone.Shadow;
            const bad = opposite(good);
            const bc = shadowBreaks ? shadowClue : lightClue;
            const why = bc >= 0 && this._clues[bc].kind === ClueKind.Lantern
                ? `Try ${name(bad)} here and the lantern marked ${printed(this._clues[bc])} could no longer see its count — so it is ${name(good)}.`
                : bc >= 0
                    ? `Try ${name(bad)} here and the clue showing ${printed(this._clues[bc])} can no longer come true — so it is ${name(good)}.`
                    : `Try ${name(bad)} here and a lantern loses its count — so it is ${name(good)}.`;
            found.push(step(u, good, Technique.LanternBudget, bc, why));
            return false;
        }
        return false;
    }
    lampReach(m, found) {
        const lamps = this._lamps, lampDist = this._lampDist;
        for (let li = 0; li < lamps.length; li++) {
            const clue = this._clues[lamps[li]];
            this.lampBfs(m, li, clue.row * this._cols + clue.col);
        }
        for (let u = 0; u < this._cells; u++) {
            if (m[u] === Mark.Shadow)
                continue;
            let reachable = false;
            for (let li = 0; li < lamps.length && !reachable; li++) {
                const d = lampDist[li * this._cells + u];
                reachable = d > 0 && d <= this._clues[lamps[li]].value;
            }
            if (reachable)
                continue;
            if (m[u] === Mark.Light)
                return true;
            found.push(step(u, Tone.Shadow, Technique.LampReach, -1, 'No lamp\'s pool can stretch this far — light here would be an orphan glow, so it is dark.'));
        }
        return false;
    }
    lampBfs(m, lamp, start) {
        const cells = this._cells, rows = this._rows, cols = this._cols;
        const dist = this._lampDist, queue = this._lampQueue;
        const baseIdx = lamp * cells;
        for (let i = 0; i < cells; i++)
            dist[baseIdx + i] = 0;
        if (m[start] === Mark.Shadow)
            return;
        let head = 0, tail = 0;
        dist[baseIdx + start] = 1;
        queue[tail++] = start;
        while (head < tail) {
            const cur = queue[head++];
            const d = dist[baseIdx + cur];
            const r = Math.floor(cur / cols), c = cur % cols;
            for (let k = 0; k < 4; k++) {
                const nr = r + Regions.DirRow[k], nc = c + Regions.DirCol[k];
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
                    continue;
                const ni = nr * cols + nc;
                if (dist[baseIdx + ni] !== 0 || m[ni] === Mark.Shadow)
                    continue;
                dist[baseIdx + ni] = d + 1;
                queue[tail++] = ni;
            }
        }
    }
    skyBridge(m, found) {
        for (let u = 0; u < this._cells; u++) {
            if (m[u] !== U)
                continue;
            const shadowBreaks = this.toneBreaks(m, u, Tone.Shadow);
            const shadowClue = this._brokenClue;
            const lightBreaks = this.toneBreaks(m, u, Tone.Light);
            const lightClue = this._brokenClue;
            if (shadowBreaks && lightBreaks)
                return true;
            if (!shadowBreaks && !lightBreaks)
                continue;
            const good = shadowBreaks ? Tone.Light : Tone.Shadow;
            const bad = opposite(good);
            const bc = shadowBreaks ? shadowClue : lightClue;
            const why = bc >= 0
                ? `Try ${name(bad)} here and the clue showing ${printed(this._clues[bc])} can no longer come true — so it is ${name(good)}.`
                : `Try ${name(bad)} here and there would be two skies — this world keeps one, so it is ${name(good)}.`;
            found.push(step(u, good, Technique.SkyBridge, bc, why));
            return false;
        }
        return false;
    }
    lightBridge(m, found) {
        for (let u = 0; u < this._cells; u++) {
            if (m[u] !== U)
                continue;
            const shadowBreaks = this.toneBreaks(m, u, Tone.Shadow);
            const shadowClue = this._brokenClue;
            const lightBreaks = this.toneBreaks(m, u, Tone.Light);
            const lightClue = this._brokenClue;
            if (shadowBreaks && lightBreaks)
                return true;
            if (!shadowBreaks && !lightBreaks)
                continue;
            const good = shadowBreaks ? Tone.Light : Tone.Shadow;
            const bad = opposite(good);
            const bc = shadowBreaks ? shadowClue : lightClue;
            const why = bc >= 0
                ? `Try ${name(bad)} here and the clue showing ${printed(this._clues[bc])} can no longer come true — so it is ${name(good)}.`
                : `Try ${name(bad)} here and the light would split in two — this world keeps one, so it is ${name(good)}.`;
            found.push(step(u, good, Technique.LightBridge, bc, why));
            return false;
        }
        return false;
    }
    evenSplitNarrow(m, found) {
        const rows = this._rows, cols = this._cols;
        for (let r = 0; r < rows; r++) {
            let light = 0, unknown = 0;
            for (let c = 0; c < cols; c++) {
                const mk = m[r * cols + c];
                if (mk === Mark.Light)
                    light++;
                else if (mk === U)
                    unknown++;
            }
            const target = Math.floor(cols / 2);
            if (light > target || light + unknown < target)
                return true;
            if (unknown === 0)
                continue;
            if (light === target) {
                for (let c = 0; c < cols; c++) {
                    const idx = r * cols + c;
                    if (m[idx] !== U)
                        continue;
                    found.push(step(idx, Tone.Shadow, Technique.EvenSplitNarrow, -1, 'That row already has its half of light, so everything still open in it is dark.'));
                }
                return false;
            }
            if (light + unknown === target) {
                for (let c = 0; c < cols; c++) {
                    const idx = r * cols + c;
                    if (m[idx] !== U)
                        continue;
                    found.push(step(idx, Tone.Light, Technique.EvenSplitNarrow, -1, 'That row can only reach its half of light if every open cell in it is light.'));
                }
                return false;
            }
        }
        for (let c = 0; c < cols; c++) {
            let light = 0, unknown = 0;
            for (let r = 0; r < rows; r++) {
                const mk = m[r * cols + c];
                if (mk === Mark.Light)
                    light++;
                else if (mk === U)
                    unknown++;
            }
            const target = Math.floor(rows / 2);
            if (light > target || light + unknown < target)
                return true;
            if (unknown === 0)
                continue;
            if (light === target) {
                for (let r = 0; r < rows; r++) {
                    const idx = r * cols + c;
                    if (m[idx] !== U)
                        continue;
                    found.push(step(idx, Tone.Shadow, Technique.EvenSplitNarrow, -1, 'That column already has its half of light, so everything still open in it is dark.'));
                }
                return false;
            }
            if (light + unknown === target) {
                for (let r = 0; r < rows; r++) {
                    const idx = r * cols + c;
                    if (m[idx] !== U)
                        continue;
                    found.push(step(idx, Tone.Light, Technique.EvenSplitNarrow, -1, 'That column can only reach its half of light if every open cell in it is light.'));
                }
                return false;
            }
        }
        return false;
    }
    lanternBudget(m, found) {
        const rows = this._rows, cols = this._cols;
        for (const ci of this._lanternClues) {
            const clue = this._clues[ci];
            const idx = clue.row * cols + clue.col;
            const want = toneToMark(clue.tone);
            if (m[idx] !== want)
                return true;
            let totalMin = 1, totalMax = 1;
            for (let d = 0; d < 4; d++) {
                this.armBounds(m, clue, d, want);
                totalMin += this._armMin;
                totalMax += this._armMax;
            }
            if (clue.value < totalMin || clue.value > totalMax)
                return true;
            const pr = printed(clue);
            if (clue.value === totalMax) {
                for (let d = 0; d < 4; d++) {
                    let r = clue.row + Regions.DirRow[d], c = clue.col + Regions.DirCol[d];
                    while (r >= 0 && r < rows && c >= 0 && c < cols) {
                        const cell = r * cols + c;
                        if (m[cell] !== want && m[cell] !== U)
                            break;
                        if (m[cell] === U)
                            found.push(step(cell, clue.tone, Technique.LanternBudget, ci, `The lantern marked ${pr} can only just see ${pr} cells, so everything within its sight is ${name(clue.tone)}.`));
                        r += Regions.DirRow[d];
                        c += Regions.DirCol[d];
                    }
                }
            }
            else if (clue.value === totalMin) {
                const oth = opposite(clue.tone);
                for (let d = 0; d < 4; d++) {
                    let r = clue.row + Regions.DirRow[d], c = clue.col + Regions.DirCol[d];
                    while (r >= 0 && r < rows && c >= 0 && c < cols && m[r * cols + c] === want) {
                        r += Regions.DirRow[d];
                        c += Regions.DirCol[d];
                    }
                    if (r < 0 || r >= rows || c < 0 || c >= cols)
                        continue;
                    const cell = r * cols + c;
                    if (m[cell] !== U)
                        continue;
                    found.push(step(cell, oth, Technique.LanternBudget, ci, `The lantern marked ${pr} already sees its full count, so the next cell along this arm is ${name(oth)}.`));
                }
            }
        }
        return false;
    }
    armBounds(m, clue, d, want) {
        const rows = this._rows, cols = this._cols;
        let min = 0, max = 0;
        let prefix = true;
        let r = clue.row + Regions.DirRow[d], c = clue.col + Regions.DirCol[d];
        while (r >= 0 && r < rows && c >= 0 && c < cols) {
            const mk = m[r * cols + c];
            if (mk !== want && mk !== U)
                break;
            max++;
            if (mk === want && prefix)
                min++;
            else
                prefix = false;
            r += Regions.DirRow[d];
            c += Regions.DirCol[d];
        }
        this._armMin = min;
        this._armMax = max;
    }
    goldWedge(m, found) {
        this.labelComponents(m);
        const nb = this._nb;
        for (let u = 0; u < this._cells; u++) {
            if (m[u] !== U)
                continue;
            let sealedShadow = false, sealedLight = false, sealedGold = false;
            let cite = -1;
            for (let d = 0; d < 4; d++) {
                const n = nb[u * 4 + d];
                if (n < 0)
                    continue;
                if (m[n] === U)
                    continue;
                const id = this._label[n];
                const rc = this._labelClue[id];
                if (rc < 0 || this._labelSize[id] !== this._clues[rc].value)
                    continue;
                if (m[n] === Mark.Shadow)
                    sealedShadow = true;
                else if (m[n] === Mark.Light)
                    sealedLight = true;
                else
                    sealedGold = true;
                cite = rc;
            }
            const sealedTones = (sealedShadow ? 1 : 0) + (sealedLight ? 1 : 0) + (sealedGold ? 1 : 0);
            if (sealedTones === 3)
                return true;
            if (sealedTones !== 2)
                continue;
            const third = !sealedShadow ? Tone.Shadow : !sealedLight ? Tone.Light : Tone.Gold;
            const one = sealedShadow ? Tone.Shadow : Tone.Light;
            const two = sealedGold ? Tone.Gold : Tone.Light;
            found.push(step(u, third, Technique.GoldWedge, cite, `This cell touches a finished ${name(one)} group and a finished ${name(two)} group it cannot join, so it is ${name(third)}.`));
        }
        return false;
    }
    goldSieve(m, found) {
        for (let u = 0; u < this._cells; u++) {
            if (m[u] !== U)
                continue;
            let alive = 0;
            let only = Tone.Shadow;
            let cite = -1;
            for (let t = 0; t < 3; t++) {
                if (this.toneBreaks(m, u, t)) {
                    if (cite < 0)
                        cite = this._brokenClue;
                }
                else {
                    alive++;
                    only = t;
                }
            }
            if (alive === 0)
                return true;
            if (alive !== 1)
                continue;
            found.push(step(u, only, Technique.GoldSieve, cite, `Every colour but ${name(only)} breaks a clue from here, so it is ${name(only)}.`));
            return false;
        }
        return false;
    }
    assume(m, cell, want) {
        m[cell] = want;
        const g = this._groupOf === null ? -1 : this._groupOf[cell];
        if (g < 0)
            return;
        for (const member of this._p.groups[g])
            if (m[member] === U)
                m[member] = want;
    }
    toneBreaks(m, cell, tone) {
        const trial = this._trial, status = this._trialStatus;
        trial.set(m);
        this.assume(trial, cell, toneToMark(tone));
        evaluate(this._p, trial, status);
        this._brokenClue = -1;
        if (status.brokenClueCount > 0) {
            const cb = status.clueBroken;
            for (let i = 0; i < cb.length; i++)
                if (cb[i] !== 0) {
                    this._brokenClue = i;
                    break;
                }
        }
        return status.brokenClueCount > 0 || status.brokenLawCount > 0;
    }
    sieveOver(m, found, technique, why) {
        const worth = this._sieveWorth;
        for (let u = 0; u < this._cells; u++) {
            if (m[u] !== U || worth[u] === 0)
                continue;
            const shadowBreaks = this.toneBreaks(m, u, Tone.Shadow);
            const shadowClue = this._brokenClue;
            const lightBreaks = this.toneBreaks(m, u, Tone.Light);
            const lightClue = this._brokenClue;
            if (shadowBreaks && lightBreaks)
                return true;
            if (!shadowBreaks && !lightBreaks)
                continue;
            const good = shadowBreaks ? Tone.Light : Tone.Shadow;
            const bc = shadowBreaks ? shadowClue : lightClue;
            found.push(step(u, good, technique, bc, `Try ${name(opposite(good))} here and ${why} — so it is ${name(good)}.`));
            return false;
        }
        return false;
    }
    clearSieveMask() {
        this._sieveWorth.fill(0);
    }
    markPatchAndFrontier(m, seed) {
        const worth = this._sieveWorth, nb = this._nb;
        if (m[seed] === U) {
            worth[seed] = 1;
            return;
        }
        this.collectComponent(m, seed, m[seed]);
        for (const cell of this._comp)
            for (let d = 0; d < 4; d++) {
                const n = nb[cell * 4 + d];
                if (n < 0)
                    continue;
                if (m[n] === U)
                    worth[n] = 1;
            }
    }
    watchSaturate(m, found) {
        const touch = this._touch;
        for (const ci of this._hoodClues) {
            const clue = this._clues[ci];
            if (clue.kind !== ClueKind.Watch)
                continue;
            let lit = 0, unknown = 0;
            touch.length = 0;
            const self = cellIndex(clue, this._cols);
            for (let d = 0; d < 4; d++) {
                const n = this._p.neighbour(self, d);
                if (n < 0)
                    continue;
                if (m[n] === Mark.Light)
                    lit++;
                else if (m[n] === U) {
                    unknown++;
                    touch.push(n);
                }
            }
            if (unknown === 0) {
                if (lit !== clue.value)
                    return true;
                continue;
            }
            if (lit > clue.value || lit + unknown < clue.value)
                return true;
            const pr = printed(clue);
            if (lit === clue.value)
                for (const n of touch)
                    found.push(step(n, Tone.Shadow, Technique.WatchSaturate, ci, `The watch showing ${pr} already touches all the light it can — so this one is dark.`));
            else if (lit + unknown === clue.value)
                for (const n of touch)
                    found.push(step(n, Tone.Light, Technique.WatchSaturate, ci, `The watch showing ${pr} needs every cell it has left — so this one is lit.`));
            if (found.length > 0)
                return false;
        }
        return false;
    }
    paneCorner(m, found) {
        const rows = this._rows, cols = this._cols;
        for (let r = 0; r + 1 < rows; r++)
            for (let c = 0; c + 1 < cols; c++) {
                const a = r * cols + c;
                let lit = 0, unknowns = 0, open = -1;
                for (let k = 0; k < 4; k++) {
                    const cell = a + (k & 1) + (k >> 1) * cols;
                    if (m[cell] === U) {
                        unknowns++;
                        open = cell;
                        continue;
                    }
                    if (m[cell] === Mark.Light)
                        lit++;
                }
                if (unknowns === 0) {
                    if (lit === 3)
                        return true;
                    continue;
                }
                if (unknowns > 1)
                    continue;
                if (lit === 3)
                    found.push(step(open, Tone.Light, Technique.PaneCorner, -1, 'Three corners of this little square are lit, and three is the one thing a lit patch may not be — so the fourth is lit too.'));
                else if (lit === 2)
                    found.push(step(open, Tone.Shadow, Technique.PaneCorner, -1, 'Lighting this corner would make three of the four, and a lit patch is never bent — so it is dark.'));
            }
        return false;
    }
    longStepSaturate(m, found) {
        const rows = this._rows, cols = this._cols, touch = this._touch;
        for (const ci of this._hoodClues) {
            const clue = this._clues[ci];
            if (clue.kind !== ClueKind.Knight)
                continue;
            const want = toneToMark(clue.tone);
            let seenCount = 0, unknown = 0;
            touch.length = 0;
            for (let k = 0; k < 8; k++) {
                const nr = clue.row + Regions.KnightRow[k], nc = clue.col + Regions.KnightCol[k];
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
                    continue;
                const n = nr * cols + nc;
                if (this._p.isVoid(n))
                    continue;
                if (m[n] === want)
                    seenCount++;
                else if (m[n] === U) {
                    unknown++;
                    touch.push(n);
                }
            }
            if (unknown === 0) {
                if (seenCount !== clue.value)
                    return true;
                continue;
            }
            if (seenCount > clue.value || seenCount + unknown < clue.value)
                return true;
            const pr = printed(clue);
            if (seenCount === clue.value)
                for (const n of touch)
                    found.push(step(n, opposite(clue.tone), Technique.LongStepSieve, ci, `The ${name(clue.tone)} ${pr} has all the cells a knight's jump away that it asked for — so this one is ${name(opposite(clue.tone))}.`));
            else if (seenCount + unknown === clue.value)
                for (const n of touch)
                    found.push(step(n, clue.tone, Technique.LongStepSieve, ci, `The ${name(clue.tone)} ${pr} needs every cell a knight's jump away that it has left — so this one is ${name(clue.tone)}.`));
            if (found.length > 0)
                return false;
        }
        return false;
    }
    crossSpend(m, found) {
        const rows = this._rows, cols = this._cols;
        const comp = this._comp, env = this._env;
        for (const ci of this._hoodClues) {
            const clue = this._clues[ci];
            if (clue.kind !== ClueKind.Cross)
                continue;
            const want = toneToMark(clue.tone);
            const self = cellIndex(clue, cols);
            let rowHave = 0, rowRoom = 0, colHave = 0, colRoom = 0;
            comp.length = 0;
            env.length = 0;
            const baseIdx = clue.row * cols;
            for (let c = 0; c < cols; c++) {
                const n = baseIdx + c;
                if (this._p.isVoid(n))
                    continue;
                if (m[n] === want)
                    rowHave++;
                else if (m[n] === U) {
                    rowRoom++;
                    comp.push(n);
                }
            }
            for (let r = 0; r < rows; r++) {
                const n = r * cols + clue.col;
                if (this._p.isVoid(n))
                    continue;
                if (m[n] === want)
                    colHave++;
                else if (m[n] === U) {
                    colRoom++;
                    env.push(n);
                }
            }
            if (m[self] === want) {
                rowHave--;
            }
            else if (m[self] === U) {
                rowRoom--;
                const k = comp.indexOf(self);
                if (k >= 0)
                    comp.splice(k, 1);
            }
            const low = rowHave + colHave, high = low + rowRoom + colRoom;
            if (clue.value < low || clue.value > high)
                return true;
            if (rowRoom + colRoom === 0)
                continue;
            const pr = printed(clue);
            const opp = opposite(clue.tone);
            if (clue.value === low) {
                for (const n of comp)
                    found.push(step(n, opp, Technique.CrossSpend, ci, `The crossroads showing ${pr} is already spent along its row and column — so this one is ${name(opp)}.`));
                for (const n of env)
                    found.push(step(n, opp, Technique.CrossSpend, ci, `The crossroads showing ${pr} is already spent along its row and column — so this one is ${name(opp)}.`));
            }
            else if (clue.value === high) {
                for (const n of comp)
                    found.push(step(n, clue.tone, Technique.CrossSpend, ci, `The crossroads showing ${pr} needs every cell its row and column have left — so this one is ${name(clue.tone)}.`));
                for (const n of env)
                    found.push(step(n, clue.tone, Technique.CrossSpend, ci, `The crossroads showing ${pr} needs every cell its row and column have left — so this one is ${name(clue.tone)}.`));
            }
            else if (colRoom === 0 && rowRoom > 0) {
                const need = clue.value - colHave;
                if (need === rowHave)
                    for (const n of comp)
                        found.push(step(n, opp, Technique.CrossSpend, ci, `The column is finished, so the row's share of ${pr} is already there — this one is ${name(opp)}.`));
                else if (need === rowHave + rowRoom)
                    for (const n of comp)
                        found.push(step(n, clue.tone, Technique.CrossSpend, ci, `The column is finished, so the row must supply the rest of ${pr} — this one is ${name(clue.tone)}.`));
            }
            else if (rowRoom === 0 && colRoom > 0) {
                const need = clue.value - rowHave;
                if (need === colHave)
                    for (const n of env)
                        found.push(step(n, opp, Technique.CrossSpend, ci, `The row is finished, so the column's share of ${pr} is already there — this one is ${name(opp)}.`));
                else if (need === colHave + colRoom)
                    for (const n of env)
                        found.push(step(n, clue.tone, Technique.CrossSpend, ci, `The row is finished, so the column must supply the rest of ${pr} — this one is ${name(clue.tone)}.`));
            }
            if (found.length > 0)
                return false;
        }
        return false;
    }
    crestCap(m, found) {
        const rows = this._rows, cols = this._cols, nb = this._nb;
        for (const ci of this._crestClues) {
            const clue = this._clues[ci];
            const pr = printed(clue);
            const length = clue.dir === Dir.Right ? cols : rows;
            for (let k = 0; k < length; k++) {
                const cell = clue.dir === Dir.Right ? clue.row * cols + k : k * cols + clue.col;
                if (m[cell] === U || this._p.isVoid(cell))
                    continue;
                this.collectComponent(m, cell, m[cell]);
                if (this._comp.length > clue.value)
                    return true;
                if (this._comp.length !== clue.value)
                    continue;
                const t = markToTone(m[cell]);
                for (const member of this._comp)
                    for (let d = 0; d < 4; d++) {
                        const n = nb[member * 4 + d];
                        if (n < 0)
                            continue;
                        if (m[n] === U)
                            found.push(step(n, opposite(t), Technique.CrestCap, ci, `Nothing along this line may run past ${pr}, and that patch is already ${pr} — so this one is ${name(opposite(t))}.`));
                    }
                if (found.length > 0)
                    return false;
            }
        }
        return false;
    }
    longStepClear(m, found) {
        const rows = this._rows, cols = this._cols;
        for (let i = 0; i < this._cells; i++) {
            if (m[i] !== Mark.Light)
                continue;
            const r = Math.floor(i / cols), c = i % cols;
            for (let k = 0; k < 8; k++) {
                const nr = r + Regions.KnightRow[k], nc = c + Regions.KnightCol[k];
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
                    continue;
                const n = nr * cols + nc;
                if (m[n] === Mark.Light)
                    return true;
                if (m[n] !== U)
                    continue;
                found.push(step(n, Tone.Shadow, Technique.LongStepClear, -1, 'A lit window will not answer another a knight\'s jump away — two along and one across — so this one is dark.'));
            }
            if (found.length > 0)
                return false;
        }
        return false;
    }
    downstream(m, found) {
        const pairs = this._p.pairs;
        if (pairs === null)
            return false;
        for (let i = 0; i < pairs.length; i += 2) {
            const tail = pairs[i], head = pairs[i + 1];
            if (m[tail] === Mark.Light && m[head] === U)
                found.push(step(head, Tone.Light, Technique.Downstream, -1, 'The cell at the tail of this weir is lit, and light runs downstream — so the head is lit.'));
            else if (m[head] !== U && m[head] !== Mark.Light && m[tail] === U)
                found.push(step(tail, Tone.Shadow, Technique.Downstream, -1, 'The head of this weir is dark, and nothing runs back up it — so the tail is dark too.'));
            else if (m[tail] === Mark.Light && m[head] !== U && m[head] !== Mark.Light)
                return true;
        }
        return false;
    }
    weighSplit(m, found) {
        const pairs = this._p.pairs;
        if (pairs === null)
            return false;
        for (let i = 0; i < pairs.length; i += 2) {
            const heavy = pairs[i], light = pairs[i + 1];
            if (m[heavy] !== U && m[light] !== U) {
                if (m[heavy] === m[light])
                    return true;
                continue;
            }
            if (m[heavy] === U && m[light] === U)
                continue;
            const known = m[heavy] !== U ? heavy : light;
            const open = known === heavy ? light : heavy;
            found.push(step(open, opposite(markToTone(m[known])), Technique.WeighSplit, -1, 'A chevron weighs two patches against each other, so it never has the same tone on both sides — this one is ' +
                name(opposite(markToTone(m[known]))) + '.'));
            return false;
        }
        return false;
    }
    sizeQuarrel(m, found) {
        const nb = this._nb;
        for (let seed = 0; seed < this._cells; seed++) {
            if (m[seed] === U || this._p.isVoid(seed))
                continue;
            this.collectComponent(m, seed, m[seed]);
            if (this._comp[0] !== seed)
                continue;
            let only = -1, ways = 0;
            for (const cell of this._comp)
                for (let d = 0; d < 4; d++) {
                    const n = nb[cell * 4 + d];
                    if (n < 0)
                        continue;
                    if (m[n] === U) {
                        if (n !== only) {
                            ways++;
                            only = n;
                        }
                    }
                }
            if (ways !== 1)
                continue;
            const size = this._comp.length;
            const mine = m[seed];
            let clash = false;
            const frontier = only;
            for (const cell of this._comp.slice()) {
                for (let d = 0; d < 4; d++) {
                    const n = nb[cell * 4 + d];
                    if (n < 0)
                        continue;
                    if (m[n] === U || m[n] === mine)
                        continue;
                    if (!this.sealed(m, n))
                        continue;
                    if (this._sealedSize === size) {
                        clash = true;
                        break;
                    }
                }
                if (clash)
                    break;
            }
            if (!clash)
                continue;
            found.push(step(frontier, markToTone(mine), Technique.SizeQuarrel, -1, `Stopping this patch at ${size} would make it match the patch it touches, and touching patches never count the same — so it grows here.`));
            return false;
        }
        return false;
    }
    sealed(m, cell) {
        const seen = this._seen, stack = this._stack, nb = this._nb;
        let count = 0;
        seen.fill(0);
        stack.length = 0;
        stack.push(cell);
        seen[cell] = 1;
        let open = false;
        while (stack.length > 0) {
            const cur = stack.pop();
            count++;
            for (let d = 0; d < 4; d++) {
                const n = nb[cur * 4 + d];
                if (n < 0)
                    continue;
                if (m[n] === U) {
                    open = true;
                    continue;
                }
                if (m[n] !== m[cell] || seen[n] !== 0)
                    continue;
                seen[n] = 1;
                stack.push(n);
            }
        }
        this._sealedSize = count;
        return !open;
    }
    twinBound(m, found) {
        const nb = this._nb, cols = this._cols;
        for (const ci of this._twinClues) {
            const clue = this._clues[ci];
            const cell = cellIndex(clue, cols);
            if (m[cell] === U)
                continue;
            if (!this.sealed(m, cell))
                continue;
            const known = this._sealedSize;
            const lbl = label(clue);
            for (const cj of this._twinClues) {
                if (cj === ci || this._clues[cj].value !== clue.value)
                    continue;
                const oth = this._clues[cj].row * cols + this._clues[cj].col;
                if (m[oth] === U)
                    continue;
                this.collectComponent(m, oth, m[oth]);
                if (this._comp.length > known)
                    return true;
                if (this._comp.length === known) {
                    const t = markToTone(m[oth]);
                    for (const member of this._comp)
                        for (let d = 0; d < 4; d++) {
                            const n = nb[member * 4 + d];
                            if (n < 0)
                                continue;
                            if (m[n] === U)
                                found.push(step(n, opposite(t), Technique.TwinBound, cj, `The other plaque marked ${lbl} closed at ${known}, so this patch is ${known} too — and it is already there.`));
                        }
                }
                else {
                    let only = -1, ways = 0;
                    for (const member of this._comp)
                        for (let d = 0; d < 4; d++) {
                            const n = nb[member * 4 + d];
                            if (n < 0)
                                continue;
                            if (m[n] === U && n !== only) {
                                ways++;
                                only = n;
                            }
                        }
                    if (ways === 1)
                        found.push(step(only, markToTone(m[oth]), Technique.TwinBound, cj, `The other plaque marked ${lbl} closed at ${known}, so this patch needs ${known} — and this is its only way there.`));
                }
                if (found.length > 0)
                    return false;
            }
        }
        return false;
    }
    shoreBounds(m, found) {
        const nb = this._nb;
        for (const ci of this._shoreClues) {
            const clue = this._clues[ci];
            const cell = cellIndex(clue, this._cols);
            if (m[cell] === U)
                continue;
            const { minArea, maxArea } = Regions.areaRangeForPerimeter(clue.value, this._cells);
            this.collectComponent(m, cell, m[cell]);
            if (this._comp.length > maxArea)
                return true;
            const t = markToTone(m[cell]);
            const pr = printed(clue);
            if (this._comp.length === maxArea) {
                for (const member of this._comp)
                    for (let d = 0; d < 4; d++) {
                        const n = nb[member * 4 + d];
                        if (n < 0)
                            continue;
                        if (m[n] === U)
                            found.push(step(n, opposite(t), Technique.ShoreBounds, ci, clue.value === 4
                                ? 'A fence of 4 goes round one cell and no more — so this one is ' + name(opposite(t)) + '.'
                                : `A fence of ${pr} cannot hold more than ${maxArea} cells, and this patch has them — so this one is ${name(opposite(t))}.`));
                    }
            }
            else if (this._comp.length < minArea) {
                let only = -1, ways = 0;
                for (const member of this._comp)
                    for (let d = 0; d < 4; d++) {
                        const n = nb[member * 4 + d];
                        if (n < 0)
                            continue;
                        if (m[n] === U && n !== only) {
                            ways++;
                            only = n;
                        }
                    }
                if (ways === 1)
                    found.push(step(only, t, Technique.ShoreBounds, ci, `A fence of ${pr} needs at least ${minArea} cells, and this is the patch's only way to get them.`));
            }
            if (found.length > 0)
                return false;
        }
        return false;
    }
    maskTheFrontier(m) {
        this.clearSieveMask();
        const worth = this._sieveWorth, nb = this._nb;
        for (let u = 0; u < this._cells; u++) {
            if (m[u] !== U)
                continue;
            for (let d = 0; d < 4; d++) {
                const n = nb[u * 4 + d];
                if (n < 0)
                    continue;
                if (m[n] !== U) {
                    worth[u] = 1;
                    break;
                }
            }
        }
    }
    comparisonSieve(m, found, technique, why) {
        this.maskTheFrontier(m);
        return this.sieveOver(m, found, technique, why);
    }
    longStepSieveArm(m, found) {
        this.clearSieveMask();
        const worth = this._sieveWorth, rows = this._rows, cols = this._cols;
        for (const ci of this._hoodClues) {
            const clue = this._clues[ci];
            if (clue.kind !== ClueKind.Knight)
                continue;
            for (let k = 0; k < 8; k++) {
                const nr = clue.row + Regions.KnightRow[k], nc = clue.col + Regions.KnightCol[k];
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
                    continue;
                worth[nr * cols + nc] = 1;
            }
        }
        return this.sieveOver(m, found, Technique.LongStepSieve, 'some knight\'s jump count can no longer come out right');
    }
    twiceToldNarrow(m, found) {
        this.clearSieveMask();
        const worth = this._sieveWorth;
        for (const ci of this._doubleClues) {
            for (const cell of this._rays[ci])
                worth[cell] = 1;
            this.markPatchAndFrontier(m, cellIndex(this._clues[ci], this._cols));
        }
        return this.sieveOver(m, found, Technique.TwiceToldNarrow, 'the number under the arrow stops being true as a patch, as a count of turns, or both');
    }
    crestSieve(m, found) {
        this.clearSieveMask();
        const worth = this._sieveWorth, rows = this._rows, cols = this._cols;
        for (const ci of this._crestClues) {
            const clue = this._clues[ci];
            const length = clue.dir === Dir.Right ? cols : rows;
            for (let k = 0; k < length; k++) {
                const cell = clue.dir === Dir.Right ? clue.row * cols + k : k * cols + clue.col;
                worth[cell] = 1;
                if (m[cell] !== U)
                    this.markPatchAndFrontier(m, cell);
            }
        }
        return this.sieveOver(m, found, Technique.CrestCap, 'a patch along that line outgrows the number, or nothing left in it can reach the number');
    }
    twinSieve(m, found) {
        this.clearSieveMask();
        for (const ci of this._twinClues)
            this.markPatchAndFrontier(m, cellIndex(this._clues[ci], this._cols));
        return this.sieveOver(m, found, Technique.TwinBound, 'the two plaques stop being able to stand in patches of one size');
    }
    shoreSieve(m, found) {
        this.clearSieveMask();
        for (const ci of this._shoreClues)
            this.markPatchAndFrontier(m, cellIndex(this._clues[ci], this._cols));
        return this.sieveOver(m, found, Technique.ShoreBounds, 'the fence round that patch can no longer come to its printed length');
    }
    degreeSeal(m, found) {
        this.clearSieveMask();
        for (const ci of this._degreeClues)
            this.markPatchAndFrontier(m, cellIndex(this._clues[ci], this._cols));
        return this.sieveOver(m, found, Technique.DegreeSeal, 'that dark patch would touch more patches than its number allows');
    }
    contradiction(m, found) {
        const nb = this._nb;
        for (let u = 0; u < this._cells; u++) {
            if (m[u] !== U)
                continue;
            let anchored = false;
            for (let d = 0; d < 4; d++) {
                const n = nb[u * 4 + d];
                if (n < 0)
                    continue;
                if (m[n] !== U) {
                    anchored = true;
                    break;
                }
            }
            if (!anchored)
                continue;
            if (this._tones === 2) {
                let survivors = 0;
                let last = Tone.Shadow;
                for (let t = 0; t < 2; t++) {
                    const assume = t === 0 ? Tone.Shadow : Tone.Light;
                    const trial = m.slice();
                    this.assume(trial, u, toneToMark(assume));
                    if (this.propagate(trial))
                        continue;
                    survivors++;
                    last = assume;
                }
                if (survivors === 0)
                    return true;
                if (survivors === 1) {
                    const broke = opposite(last);
                    found.push(step(u, last, Technique.Contradiction, -1, `Try ${name(broke)} here and follow it out — the board breaks. So it is ${name(last)}.`));
                    return false;
                }
            }
            else {
                let survivors = 0;
                let last = Tone.Shadow;
                for (let t = 0; t < 3; t++) {
                    const trial = m.slice();
                    this.assume(trial, u, toneToMark(t));
                    if (this.propagate(trial))
                        continue;
                    survivors++;
                    last = t;
                }
                if (survivors === 0)
                    return true;
                if (survivors === 1) {
                    found.push(step(u, last, Technique.Contradiction, -1, `Every other colour breaks the board from here. So it is ${name(last)}.`));
                    return false;
                }
            }
        }
        return false;
    }
    propagate(m) {
        const batch = [];
        while (true) {
            batch.length = 0;
            if (this.findEasiest(m, batch, false))
                return true;
            if (batch.length === 0)
                return false;
            for (const st of batch) {
                const want = toneToMark(st.tone);
                if (m[st.cell] !== U && m[st.cell] !== want)
                    return true;
                m[st.cell] = want;
                const g = this._groupOf === null ? -1 : this._groupOf[st.cell];
                if (g < 0)
                    continue;
                for (const member of this._p.groups[g]) {
                    if (m[member] === want)
                        continue;
                    if (m[member] !== U)
                        return true;
                    m[member] = want;
                }
            }
        }
    }
    may(t) { return !this._freeOnly || isFreeRead(t); }
    rate(r) {
        if (!r.solved) {
            r.rating = 4;
            return r;
        }
        let tier = 0, atTier = 0, deep = 0;
        for (const st of r.trace) {
            const t = tierOf(st.technique);
            if (t > tier) {
                tier = t;
                atTier = 0;
            }
            if (t === tier)
                atTier++;
            if (isDeep(st.technique))
                deep++;
        }
        if (tier >= 4) {
            r.rating = 4;
            return r;
        }
        if (tier < 2) {
            r.rating = tier;
            return r;
        }
        if (tier === 2) {
            const share = r.trace.length === 0 ? 0.0 : deep / r.trace.length;
            r.rating = share >= DeepShareForHard ? 3 : 2;
            return r;
        }
        r.rating = atTier >= 4 ? 4 : 3;
        return r;
    }
    collectComponent(m, start, want) {
        const comp = this._comp, seen = this._seen, stack = this._stack, nb = this._nb;
        comp.length = 0;
        seen.fill(0);
        stack.length = 0;
        seen[start] = 1;
        stack.push(start);
        while (stack.length > 0) {
            const cur = stack.pop();
            comp.push(cur);
            for (let d = 0; d < 4; d++) {
                const n = nb[cur * 4 + d];
                if (n < 0)
                    continue;
                if (seen[n] !== 0 || m[n] !== want)
                    continue;
                seen[n] = 1;
                stack.push(n);
            }
        }
    }
    collectEnvelope(m, start, want, blocked) {
        const env = this._env, seen = this._seen, stack = this._stack, nb = this._nb;
        env.length = 0;
        seen.fill(0);
        stack.length = 0;
        seen[start] = 1;
        stack.push(start);
        while (stack.length > 0) {
            const cur = stack.pop();
            env.push(cur);
            for (let d = 0; d < 4; d++) {
                const n = nb[cur * 4 + d];
                if (n < 0)
                    continue;
                if (seen[n] !== 0 || n === blocked)
                    continue;
                if (m[n] !== want && m[n] !== U)
                    continue;
                seen[n] = 1;
                stack.push(n);
            }
        }
        return env.length;
    }
    labelComponents(m) {
        const lab = this._label, stack = this._stack, nb = this._nb;
        lab.fill(-1);
        this._labelSize.length = 0;
        this._labelClue.length = 0;
        for (let start = 0; start < this._cells; start++) {
            if (lab[start] !== -1 || m[start] === U)
                continue;
            const id = this._labelSize.length;
            const want = m[start];
            let size = 0, clue = -1;
            stack.length = 0;
            lab[start] = id;
            stack.push(start);
            while (stack.length > 0) {
                const cur = stack.pop();
                size++;
                if (this._regionClueAt[cur] >= 0)
                    clue = this._regionClueAt[cur];
                for (let d = 0; d < 4; d++) {
                    const n = nb[cur * 4 + d];
                    if (n < 0)
                        continue;
                    if (lab[n] !== -1 || m[n] !== want)
                        continue;
                    lab[n] = id;
                    stack.push(n);
                }
            }
            this._labelSize.push(size);
            this._labelClue.push(clue);
        }
    }
}
export function ladderSolution(puzzle) {
    const run = new LadderSolver(puzzle).solve(null, true);
    if (!run.solved)
        return null;
    const tones = new Uint8Array(puzzle.cellCount);
    for (let i = 0; i < tones.length; i++)
        tones[i] = markToTone(run.marks[i]);
    return tones;
}
export function withLadderSolution(puzzle) {
    if (puzzle.solution !== null)
        return puzzle;
    const solution = ladderSolution(puzzle);
    if (solution === null)
        return puzzle;
    return new Puzzle({
        rows: puzzle.rows, cols: puzzle.cols, clues: puzzle.clues, solution,
        difficulty: puzzle.difficulty, id: puzzle.id, chapter: puzzle.chapter, title: puzzle.title,
        mechanic: puzzle.mechanic, walls: puzzle.walls, groups: puzzle.groups,
        pairs: puzzle.pairs, voids: puzzle.voids,
    });
}

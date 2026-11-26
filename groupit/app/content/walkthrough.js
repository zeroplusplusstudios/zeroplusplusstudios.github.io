import { Clues, isMargin } from '../core/clue.js';
import { evaluate } from '../core/clueEval.js';
import * as MarkRegions from '../core/markRegions.js';
import { Puzzle } from '../core/puzzle.js';
import { Status } from '../core/status.js';
import { Mark, Tone } from '../core/types.js';
export const PanTime = 0.55;
export const HintAfter = 6;
export const IdleWait = 4;
export const NudgeEvery = 5;
export const GuideRest = 1.4;
export const RefusalWindow = 10;
export const RefusedFlash = 0.3;
export const Glide = 0.5, PressTime = 0.12, TapBody = 0.12, Release = 0.14, Linger = 0.3, Leave = 0.35;
export const MinHold = 0.6, RippleTime = 0.45;
const D = Tone.Shadow, L = Tone.Light;
export const Stations = [
    { id: 'three', rows: 1, cols: 4, scale: 1, clues: [Clues.region(0, 0, D, 3)], answer: '###.' },
    {
        id: 'twos', rows: 2, cols: 2, scale: 2,
        clues: [Clues.region(0, 0, L, 2), Clues.region(1, 0, D, 2)],
        answer: '..##',
    },
    {
        id: 'two-groups', rows: 3, cols: 3, scale: 4 / 3,
        clues: [Clues.region(0, 1, D, 2), Clues.region(2, 1, L, 1)],
        answer: '.#..#.#.#',
    },
    {
        id: 'first-board', rows: 4, cols: 4, scale: 1,
        clues: [
            Clues.region(0, 3, D, 1), Clues.region(1, 2, D, 1), Clues.region(2, 0, D, 4),
            Clues.region(2, 2, L, 4), Clues.region(3, 1, D, 1),
        ],
        answer: '##.##.#.#..#.#.#',
    },
];
const dark = (cell, say = null, wrong = null) => ({ cell, tone: Mark.Shadow, say, wrong });
const light = (cell, say = null, wrong = null) => ({ cell, tone: Mark.Light, say, wrong });
export const WrongTone = 'This cell must be {want}.\n{fixW}';
export const Stuck = 'Stuck? Wait for a hint.';
export const ThreeAsk = 'The 3 needs 3 dark cells.\n{PressD} the grey cell next to it.';
export const TwoUsesTheMiddle = 'The 2 uses the middle cell, not this one.\n{fixL}';
export const LoneOne = 'A dark 1 is full: light all around it.\n{TapL} here.';
export const FullFour = 'The light 4 is full: dark all around it.\n{TapD} here.';
export const LightJoinsTheOne = 'A light cell here would join the 1.\n{fixD}';
export const DarkJoinsAnOne = 'A dark cell here would join a dark 1.\n{fixL}';
export const LightGrowsTheFour = 'A light cell here would grow the light 4.\n{fixD}';
export const FourNeedsThis = 'The dark 4 needs this cell to reach 4.\n{fixD}';
const scene = (s) => ({
    done: null, going: null, wrong: null, guided: false, hintAfter: 0, handAfter: 0, counts: false, callouts: [],
    ...s,
});
export const Scenes = [
    scene({
        id: 'b1-three', station: 0, title: 'Make a group of 3',
        body: ThreeAsk,
        done: 'A group of 3!',
        wrong: WrongTone,
        start: '----', guided: true, handAfter: 0.4, counts: true,
        callouts: [
            { cell: 0, at: 'corner', text: '{n} so far', after: null },
            { cell: 0, at: 'digit', text: 'needs 3', after: null },
        ],
        moves: [
            dark(1, ThreeAsk, 'A light cell cuts the 3 short.\n{fixD}'),
            dark(2, 'Touching cells make one group.\n{PressD} the next one.', 'A light cell cuts the 3 short.\n{fixD}'),
            light(3, 'The 3 is full. Every cell ends dark or light.\n{PressL} this one.', 'The 3 stops at 3 cells: this one is light.\n{fixL}'),
        ],
    }),
    scene({
        id: 'b2-twos', station: 1, title: 'Grow the 2s',
        body: 'The light 2 has one cell to grow into.\n{PressL} the cell beside it.',
        done: 'Both 2s are full!',
        wrong: WrongTone,
        start: '----', guided: true, handAfter: 3, counts: true,
        moves: [
            light(1, 'The light 2 has one cell to grow into.\n{PressL} the cell beside it.', 'Dark leaves the light 2 stuck at 1.\n{fixL}'),
            dark(3, 'The dark 2 has one cell to grow into.\n{PressD} the cell beside it.', 'Light leaves the dark 2 stuck at 1.\n{fixD}'),
        ],
    }),
    scene({
        id: 'b3-two-groups', station: 2, title: 'A lone 1',
        body: 'The light 1 is full. Dark goes around it.\n{TapD} the cells around it.',
        going: 'Fill every cell.\n' + Stuck,
        done: 'Every number is full!',
        wrong: WrongTone,
        start: '---------', hintAfter: 4, counts: true,
        moves: [
            dark(6, 'The light 1 is full. Dark goes around it.\n{TapD} the cell beside it.', LightJoinsTheOne),
            dark(8, 'A full 1 has dark on every side.\n{TapD} the other side.', LightJoinsTheOne),
            dark(4, 'Dark above the 1. It also joins the 2.\n{TapD} here.', LightJoinsTheOne),
            light(0, 'The 2 is full. Light goes around it.\n{TapL} here.', TwoUsesTheMiddle),
            light(2, 'Beside the full 2: light.\n{TapL} here.', TwoUsesTheMiddle),
            light(3, 'Beside the full 2: light.\n{TapL} here.', TwoUsesTheMiddle),
            light(5, 'Beside the full 2: light.\n{TapL} here.', TwoUsesTheMiddle),
        ],
    }),
    scene({
        id: 'b4-first-board', station: 3, title: 'Your first board',
        body: 'Fill every cell.\n' + Stuck,
        done: "Board done! You're ready to play.",
        wrong: WrongTone,
        start: '----------------', counts: true,
        moves: [
            light(2, LoneOne, DarkJoinsAnOne), light(5, LoneOne, DarkJoinsAnOne), light(7, LoneOne, DarkJoinsAnOne),
            light(9, LoneOne, DarkJoinsAnOne), light(12, LoneOne, DarkJoinsAnOne), light(14, LoneOne, DarkJoinsAnOne),
            dark(4, FullFour, LightGrowsTheFour), dark(1, FullFour, LightGrowsTheFour),
            dark(11, FullFour, LightGrowsTheFour), dark(15, FullFour, LightGrowsTheFour),
            dark(0, 'The dark 4 needs one more cell.\n{TapD} here.', FourNeedsThis),
        ],
    }),
];
export const Count = Scenes.length;
export function asks(s, cell) {
    for (const m of s.moves)
        if (m.cell === cell)
            return m.tone;
    return Mark.Unknown;
}
export function isPrinted(station, cell) {
    for (const c of station.clues)
        if (c.row * station.cols + c.col === cell)
            return true;
    return false;
}
function tones(answer) {
    const out = new Uint8Array(answer.length);
    for (let i = 0; i < out.length; i++)
        out[i] = answer[i] === '#' ? Tone.Shadow : Tone.Light;
    return out;
}
export function toPuzzle(station) {
    return new Puzzle({
        rows: station.rows, cols: station.cols, clues: station.clues, solution: tones(station.answer),
        id: 'walk-' + station.id,
    });
}
export function beat(s) {
    let words = 0;
    if (s !== null && s.done !== null && s.done.length > 0)
        words = s.done.split(/[ \n ]/).filter((w) => w.length > 0).length;
    const seconds = 0.6 + 0.28 * words;
    return seconds < 1.2 ? 1.2 : seconds > 2.2 ? 2.2 : seconds;
}
const cap = (word) => word[0].toUpperCase() + word.slice(1);
export function isHold(tone, lightFirst) {
    return tone === Mark.Light ? !lightFirst : tone === Mark.Shadow && lightFirst;
}
export function fix(tone, lightFirst) {
    const word = tone === Mark.Shadow ? 'dark' : 'light';
    return isHold(tone, lightFirst) ? `Press and hold it for ${word}.` : `Tap to clear it, then tap for ${word}.`;
}
const replaceAll = (s, from, to) => s.split(from).join(to);
export function say(text, lightFirst, want = Mark.Unknown) {
    if (text === null || text.length === 0)
        return text ?? '';
    const dk = lightFirst ? 'hold' : 'tap', lt = lightFirst ? 'tap' : 'hold';
    const darkLong = lightFirst ? 'press and hold' : 'tap', lightLong = lightFirst ? 'tap' : 'press and hold';
    let s = text;
    s = replaceAll(s, '{tapD}', dk);
    s = replaceAll(s, '{tapL}', lt);
    s = replaceAll(s, '{TapD}', cap(dk));
    s = replaceAll(s, '{TapL}', cap(lt));
    s = replaceAll(s, '{pressD}', darkLong);
    s = replaceAll(s, '{pressL}', lightLong);
    s = replaceAll(s, '{PressD}', cap(darkLong));
    s = replaceAll(s, '{PressL}', cap(lightLong));
    s = replaceAll(s, '{fixD}', fix(Mark.Shadow, lightFirst));
    s = replaceAll(s, '{fixL}', fix(Mark.Light, lightFirst));
    if (want === Mark.Shadow || want === Mark.Light) {
        const gesture = want === Mark.Shadow ? dk : lt;
        s = replaceAll(s, '{want}', want === Mark.Shadow ? 'dark' : 'light');
        s = replaceAll(s, '{tapW}', gesture);
        s = replaceAll(s, '{TapW}', cap(gesture));
        s = replaceAll(s, '{fixW}', fix(want, lightFirst));
    }
    return s;
}
export const TooBigText = 'This group must be {n}, but it is {s}.\n{fixW}';
export const TooSmallText = 'This cell leaves the {tone} {n} stuck at {s}.\n{fixW}';
export function slipByNumbers(lightFirst, want, number, size, tone) {
    let s = say(size > number ? TooBigText : TooSmallText, lightFirst, want);
    s = replaceAll(s, '{tone}', tone === Tone.Shadow ? 'dark' : 'light');
    s = replaceAll(s, '{n}', String(number));
    s = replaceAll(s, '{s}', String(size));
    return s;
}
export const NoBreakSpace = ' ';
export function glue(text) {
    if (text === null || text.length === 0)
        return text ?? '';
    const rows = text.split('\n');
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let spaces = 0;
        for (const c of row)
            if (c === ' ')
                spaces++;
        if (spaces < 2)
            continue;
        const last = row.lastIndexOf(' ');
        if (last < 0 || last === row.length - 1)
            continue;
        if (row.indexOf(NoBreakSpace, last + 1) >= 0)
            continue;
        rows[i] = row.substring(0, last) + NoBreakSpace + row.substring(last + 1);
    }
    return rows.join('\n');
}
export function nameTheGroup(puzzle, marks, slip) {
    const rows = puzzle.rows, cols = puzzle.cols, cells = rows * cols;
    if (marks === null || marks.length !== cells || slip < 0 || slip >= cells || marks[slip] === Mark.Unknown)
        return null;
    const grid = Uint8Array.from(marks);
    const id = new Int32Array(cells);
    const sizes = new Int32Array(cells);
    const slots = new Int32Array(cells);
    const groups = MarkRegions.tag(grid, rows, cols, id, sizes, slots, puzzle);
    const status = new Status();
    evaluate(puzzle, grid, status);
    if (status.clueBroken === null)
        return null;
    const sr = Math.floor(slip / cols), sc = slip % cols, own = id[slip];
    let best = -1, bestOver = Number.MAX_SAFE_INTEGER, bestDistance = Number.MAX_SAFE_INTEGER;
    for (let k = 0; k < puzzle.clues.length && k < status.clueBroken.length; k++) {
        const clue = puzzle.clues[k];
        if (isMargin(clue) || status.clueBroken[k] === 0)
            continue;
        const at = clue.row * cols + clue.col, group = id[at];
        if (group < 0)
            continue;
        const inside = group === own;
        let touching = false;
        for (let d = 0; d < 4 && !inside && !touching; d++) {
            const nr = sr + (d === 0 ? -1 : d === 1 ? 1 : 0), nc = sc + (d === 2 ? -1 : d === 3 ? 1 : 0);
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && id[nr * cols + nc] === group)
                touching = true;
        }
        const tooBig = sizes[at] > clue.value;
        if (tooBig ? !inside : !touching)
            continue;
        const over = tooBig ? 0 : 1;
        const distance = Math.abs(clue.row - sr) + Math.abs(clue.col - sc);
        if (over < bestOver || (over === bestOver && distance < bestDistance)) {
            best = k;
            bestOver = over;
            bestDistance = distance;
        }
    }
    if (best < 0)
        return null;
    const chosen = puzzle.clues[best];
    const cell = chosen.row * cols + chosen.col;
    const n = chosen.value, s = sizes[cell];
    if (n <= 0 || s <= 0 || s === n)
        return null;
    const label = new Int32Array(cells);
    MarkRegions.labelCells(id, cells, groups, puzzle, label);
    const g = id[cell];
    const ring = g >= 0 && g < cells && label[g] >= 0 ? label[g] : cell;
    let printsIt = false;
    for (const clue of puzzle.clues)
        if (!isMargin(clue) && clue.row * cols + clue.col === ring && clue.value === n) {
            printsIt = true;
            break;
        }
    if (!printsIt)
        return null;
    return { number: n, size: s, badgeCell: ring, tone: chosen.tone };
}
export function startOf(s) {
    const station = Stations[s.station];
    const marks = new Array(station.rows * station.cols);
    for (let i = 0; i < marks.length; i++) {
        const c = i < s.start.length ? s.start[i] : '-';
        marks[i] = c === '#' ? Mark.Shadow : c === '.' ? Mark.Light : Mark.Unknown;
    }
    for (const clue of station.clues)
        marks[clue.row * station.cols + clue.col] = clue.tone === Tone.Shadow ? Mark.Shadow : clue.tone === Tone.Light ? Mark.Light : Mark.Gold;
    return marks;
}
export function endOf(s) {
    const marks = startOf(s);
    for (const m of s.moves)
        marks[m.cell] = m.tone;
    return marks;
}

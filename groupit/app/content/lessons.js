import { Clues } from '../core/clue.js';
import { Mechanic } from '../core/mechanic.js';
import { Puzzle } from '../core/puzzle.js';
import { Dir, Mark, Tone } from '../core/types.js';
export const OffTarget = "That's not the cell the question names. Read it again.";
export const WebWording = [
    {
        mechanic: Mechanic.GoldHour,
        from: 'Double-tap for gold, or pick it on a Gold board.',
        to: 'Pick Gold on the tone button, then tap.',
    },
];
const S = Tone.Shadow, L = Tone.Light;
export const RuleCards = [
    {
        mechanic: Mechanic.Ledger, art: 'LedgerTallies', board: 'TryTally',
        title: 'The margin counts the light', titleSource: 'tagline',
        pageTitle: 'The margin counts the light',
        appBody: 'A number on a SOLID tile counts the lit cells down its line. Spend it as you mark: '
            + 'when the lit cells reach the count, the rest of that line is dark; when the gaps '
            + 'are exactly what is left, they are all light.',
        ask: 'The margin says one lit cell in this row, and one is already lit. The last cell?',
        nudge: 'The tally is spent — whatever is left in the row cannot be light.',
        rows: 1, cols: 3, clues: [Clues.rowTally(0, 1)],
        solution: '.##', given: '.#?', target: 2, answer: S, voids: null,
    },
    {
        mechanic: Mechanic.UnlitNumeral, art: 'UnlitNumerals', board: 'TryUnlit',
        title: 'A number that hides its colour', titleSource: 'tagline',
        pageTitle: 'A number that hides its colour',
        appBody: 'An unlit numeral measures its group like any other number, but keeps its colour to '
            + 'itself — and the cell under it stays YOURS to mark. Ask which colour could carry the '
            + 'count: the one it cannot survive is one the cell cannot take.',
        ask: 'A bare 1 with no colour to it. Which colour can keep it true?',
        nudge: 'Try it lit: the 1 would join the lit pair beside it and measure three.',
        rows: 1, cols: 3, clues: [Clues.open(0, 0, 1)],
        solution: '#..', given: '?..', target: 0, answer: S, voids: null,
    },
    {
        mechanic: Mechanic.OneSky, art: 'OneSky', board: 'TrySky',
        title: 'All the dark is one piece', titleSource: 'tagline',
        pageTitle: 'One sky over everything',
        appBody: 'All the dark in an answer here is one connected piece, so a cell whose lighting would '
            + 'tear the sky in two is not lit: the bridge belongs to the dark. The dark is one patch, '
            + 'so a number on it counts all of it.',
        ask: 'All the dark here is one connected sky. What keeps these two arms one piece?',
        nudge: 'Mark it lit and the dark falls into two separate pieces — and every answer '
            + 'here has exactly one.',
        rows: 3, cols: 3, clues: [],
        solution: '#.#' + '###' + '...', given: '#.#' + '#?#' + '...', target: 4, answer: S, voids: null,
    },
    {
        mechanic: Mechanic.GoldHour, art: 'GoldTone', board: 'TryGold',
        title: 'A third colour, neither dark nor light', titleSource: 'tagline',
        pageTitle: 'The gold hour',
        appBody: 'A third tone: gold groups obey the rule too — two never touch, as two dark groups never '
            + 'touch. New is the wedge — a cell that can be neither dark nor light has one '
            + 'tone left. Double-tap for gold, or pick it on a Gold board.',
        ask: 'A dark 1 and a lit 1, one cell between them. Neither tone can take it — so what can?',
        nudge: 'Joining either 1 would grow it past one cell. The third tone touches neither.',
        rows: 1, cols: 3, clues: [Clues.region(0, 0, S, 1), Clues.region(0, 2, L, 1)],
        solution: '#*.', given: '#?.', target: 1, answer: Tone.Gold, voids: null,
    },
    {
        mechanic: Mechanic.Turnstile, art: 'Turnstiles', board: 'TryTurnstile',
        title: 'Counts colour changes along a line', titleSource: 'tagline',
        pageTitle: 'Counts colour changes along a line',
        appBody: 'This number counts turns, not lit cells — its chip is part dark and part light, and '
            + 'the seam is what it counts. It says how many times the line changes tone end to '
            + 'end, so a 0 never changes and hands you the whole line.',
        ask: 'The margin says this row never turns, and both ends are dark. The gap?',
        nudge: 'No turns at all means every cell in the line is the same tone as its neighbour.',
        rows: 1, cols: 3, clues: [Clues.rowTurns(0, 1)],
        solution: '###', given: '#?#', target: 1, answer: S, voids: null,
    },
    {
        mechanic: Mechanic.Watch, art: 'Watch', board: 'TryWatch',
        title: 'Counts the light cells beside it', titleSource: 'tagline',
        pageTitle: 'Counts the light cells beside it',
        appBody: 'A watch is a number inside a hollow ring in its corner. It counts its lit neighbours '
            + '— cells above, below, left, right — so up to four: three at an edge, two in a '
            + 'corner. It says nothing about its own cell, which you still mark.',
        ask: 'The watch shows 2, and a corner has two neighbours. The bottom-middle cell?',
        nudge: 'A watch in a corner has just two neighbours. If it counts 2, both of them are lit.',
        rows: 3, cols: 3, clues: [Clues.region(0, 2, L, 2), Clues.region(1, 0, L, 2), Clues.watch(2, 0, 2)],
        solution: '.#.' + '.#.' + '#.#', given: '?????????', target: 7, answer: L, voids: null,
    },
    {
        mechanic: Mechanic.Windowlight, art: 'Windowlight', board: 'TryWindowlight',
        title: 'Every light patch is a solid rectangle', titleSource: 'tagline',
        pageTitle: 'Every light patch is a solid rectangle',
        appBody: 'Lit patches here are solid blocks, never bent. Three lit corners of any little square '
            + 'hand you the fourth — and two lit corners with a dark one hand you another dark.',
        ask: 'One lit patch bends round the middle cell. Light or dark?',
        nudge: 'Dark there, and the lit patch stays bent round it — but a lit patch is never bent.',
        rows: 3, cols: 3, clues: [Clues.region(1, 2, S, 2)],
        solution: '..#' + '..#' + '##.', given: '..?' + '.??' + '???', target: 4, answer: L, voids: null,
    },
    {
        mechanic: Mechanic.TwiceTold, art: 'Twice', board: 'TryTwice',
        title: 'One number, true two ways', titleSource: 'tagline',
        pageTitle: 'One number, true two ways',
        appBody: 'The number under this arrow has to be true twice: how many cells are in the patch, '
            + 'and how many times the colour changes on the way to the edge. Find the tone that '
            + 'fits both.',
        ask: 'Only one tone here keeps both readings of that number true. Which one?',
        nudge: 'Try it dark: check the patch it would make, then count the changes up the arrow.',
        rows: 3, cols: 3, clues: [Clues.region(2, 1, L, 4), Clues.region(1, 1, S, 3), Clues.double(1, 2, Dir.Up, 1)],
        solution: '.##.#...#', given: '?????????', target: 5, answer: L, voids: null,
    },
    {
        mechanic: Mechanic.Well, art: 'Well', board: 'TryWell',
        title: 'A hole, not a dark square', titleSource: 'tagline',
        pageTitle: 'A hole, not a dark square',
        appBody: 'The gap is a hole in the board, not a dark square. Nothing lives there and nothing '
            + 'crosses it, so a patch has to go round.',
        ask: 'Under the top dark 3 is the hole, and the cell left of the 3 is lit. The top-right cell?',
        nudge: 'A hole is not a dark cell, and nothing crosses it. The 3 has to go round — and '
            + 'right is its only way.',
        rows: 3, cols: 3, clues: [Clues.region(0, 1, S, 3), Clues.region(2, 1, S, 3)],
        solution: '.##' + '###' + '##.', given: '.??' + '???' + '???', target: 2, answer: S, voids: [4],
    },
    {
        mechanic: Mechanic.StrayLight, art: 'StrayLight', board: 'TryStray',
        title: 'Every patch of light needs a number', titleSource: 'page',
        pageTitle: 'Every patch of light needs a number',
        appBody: "Every patch of light — a pool — needs a lamp: a lit number. The number is the pool's "
            + 'size, the lamp included: a lamp of 2 stretches one cell beyond itself. A cell too '
            + 'far from every lamp to join its pool is dark.',
        ask: 'Every pool of light needs a lit number, and this board has none. The last cell?',
        nudge: 'This board has no lit numbers, so no lamp. A pool of light needs one, so no '
            + 'cell here can be light.',
        rows: 2, cols: 3, clues: [],
        solution: '###' + '###', given: '###' + '#?#', target: 4, answer: S, voids: null,
    },
    {
        mechanic: Mechanic.LanternReach, art: 'Lanterns', board: 'TryLantern',
        title: 'As far as the lantern sees', titleSource: 'page',
        pageTitle: 'As far as the lantern sees',
        appBody: 'A ringed number is a lantern: it counts the cells of its own tone it can SEE — '
            + 'itself, then out along its row and column until the tone changes. Spend the count '
            + 'arm by arm. A neighbour the count cannot afford is the other tone.',
        ask: 'The lantern counts 1 — itself and nothing more. What is the cell beside it?',
        nudge: 'One more dark cell in its row and the lantern would see two.',
        rows: 1, cols: 3, clues: [Clues.lantern(0, 0, S, 1)],
        solution: '#..', given: '#??', target: 1, answer: L, voids: null,
    },
    {
        mechanic: Mechanic.LongStep, art: 'LongStep', board: 'TryLongStep',
        title: "Counts like a chess knight's jump", titleSource: 'page',
        pageTitle: "Counts like a chess knight's jump",
        appBody: "A small L in a number's corner means a chess knight's jump: two cells along, one "
            + 'across. The number counts the cells a jump away that match its own colour — light '
            + 'counts light, dark counts dark. What lies between never matters.',
        ask: "A light 0 has no light cell a knight's jump away. What is the top-left cell?",
        nudge: "Find the cells a knight's jump away: two along one way, one across the other. "
            + 'Only two fit on this board.',
        rows: 3, cols: 3,
        clues: [Clues.region(2, 0, L, 4), Clues.region(1, 2, S, 5), Clues.knight(2, 1, L, 0), Clues.knight(0, 1, S, 1)],
        solution: '###..#..#', given: '?????????', target: 0, answer: S, voids: null,
    },
    {
        mechanic: Mechanic.Crossroads, art: 'Crossroads', board: 'TryCrossroads',
        title: 'Counts along its row and column', titleSource: 'page',
        pageTitle: 'Counts along its row and column',
        appBody: 'This number counts its own tone all the way down its row and across its column, '
            + 'counting itself once. Spend what the row already shows; what is left belongs to '
            + 'the column.',
        ask: 'A crossroads has already found all the light it was counting. This cell?',
        nudge: 'Add its row and its column, take one back for the cell it stands on.',
        rows: 3, cols: 3, clues: [Clues.region(2, 0, S, 3), Clues.cross(2, 2, L, 3), Clues.cross(1, 2, L, 2)],
        solution: '..###.#..', given: '?????????', target: 3, answer: S, voids: null,
    },
    {
        mechanic: Mechanic.BigHouse, art: 'Crest', board: 'TryBigHouse',
        title: 'The biggest patch along the line', titleSource: 'page',
        pageTitle: 'The biggest patch along the line',
        appBody: 'A bar over the number reads its ROW; a bar down its left reads its COLUMN. The number '
            + 'is the size of the biggest patch, dark or light, with a cell in that line — not '
            + 'necessarily the patch it stands on.',
        ask: 'The 2 reads its row: nothing along it may run past 2. The last cell of row two?',
        nudge: 'Darkening it would join the dark pair above into a run of three — and that '
            + 'run has a cell in the row the 2 reads.',
        rows: 4, cols: 3,
        clues: [Clues.region(1, 1, L, 8), Clues.crest(0, 0, L, Dir.Right, 2), Clues.crest(0, 1, S, Dir.Down, 8)],
        solution: '.###........', given: '??#?????????', target: 5, answer: L, voids: null,
    },
    {
        mechanic: Mechanic.LikeForLike, art: 'Twin', board: 'TryTwin',
        title: 'Two patches of the same size', titleSource: 'page',
        pageTitle: 'Two patches of the same size',
        appBody: 'Two cells wear the same mark: =A and =A. Their patches hold the same number of cells, '
            + 'and the board never prints what that number is. So find the size on one of the '
            + 'pair, and spend it on the other.',
        ask: 'One =A patch has closed. What does that make the cell under the other =A?',
        nudge: 'Find the =A whose patch has finished, count its cells, and give the other =A '
            + 'the same size.',
        rows: 4, cols: 4,
        clues: [Clues.region(1, 3, L, 4), Clues.region(2, 2, S, 2), Clues.region(3, 2, L, 5), Clues.twin(0, 1, 0), Clues.twin(3, 1, 0)],
        solution: '##..##..#.##....', given: '????????????????', target: 13, answer: L, voids: null,
    },
    {
        mechanic: Mechanic.Shoreline, art: 'Shore', board: 'TryShore',
        title: 'Counts the fence around a patch', titleSource: 'page',
        pageTitle: 'Counts the fence around a patch',
        appBody: 'A framed number is the fence around its patch: one for every cell side facing the '
            + 'other colour, and the board edge counts too. The cells inside do not. So a lone '
            + 'cell is 4, and a 6 is exactly two cells.',
        ask: 'The framed 10 needs more room than its patch has. Which cell can it grow into?',
        nudge: 'A longer fence means a bigger patch — count the room it has left to reach one.',
        rows: 3, cols: 3, clues: [Clues.region(2, 1, S, 2), Clues.shore(2, 2, L, 10), Clues.shore(1, 0, L, 6)],
        solution: '#...#..#.', given: '?????????', target: 5, answer: L, voids: null,
    },
];
const BY_MECHANIC = new Map(RuleCards.map((c) => [c.mechanic, c]));
export function cardFor(mechanic) {
    if (mechanic === Mechanic.None)
        return null;
    return BY_MECHANIC.get(mechanic) ?? null;
}
export function body(card) {
    let out = card.appBody;
    for (const w of WebWording)
        if (w.mechanic === card.mechanic)
            out = out.split(w.from).join(w.to);
    return out;
}
export function gestureFor(answer) {
    return answer === Tone.Gold ? 'gold' : answer === Tone.Light ? 'hold' : 'tap';
}
export function gestureWords(g) {
    return g === 'tap' ? 'Tap' : g === 'hold' ? 'Press and hold' : 'Pick Gold, then tap';
}
function toneOf(c) {
    return c === '#' ? Tone.Shadow : c === '.' ? Tone.Light : Tone.Gold;
}
export function cardPuzzle(card) {
    const solution = new Uint8Array(card.rows * card.cols);
    for (let i = 0; i < solution.length; i++)
        solution[i] = toneOf(card.solution[i]);
    return new Puzzle({
        rows: card.rows, cols: card.cols, clues: card.clues, solution, mechanic: card.mechanic,
        voids: card.voids === null ? null : [...card.voids],
    });
}
export function givenMarks(card) {
    return [...card.given].map((c) => c === '?' ? Mark.Unknown : c === '#' ? Mark.Shadow : c === '.' ? Mark.Light : Mark.Gold);
}
export class TryJudge {
    card;
    #misses = 0;
    #settled = false;
    constructor(card) { this.card = card; }
    get settled() { return this.#settled; }
    get misses() { return this.#misses; }
    judge(cell, mark) {
        if (this.#settled)
            return { kind: 'none' };
        const answer = this.card.answer === Tone.Shadow ? Mark.Shadow : this.card.answer === Tone.Light ? Mark.Light : Mark.Gold;
        if (cell === this.card.target && mark === answer) {
            this.#settled = true;
            return { kind: 'solved', byPlayer: true };
        }
        if (mark === Mark.Unknown)
            return { kind: 'none' };
        this.#misses++;
        if (this.#misses >= 2) {
            this.#settled = true;
            return { kind: 'solved', byPlayer: false };
        }
        return cell === this.card.target ? { kind: 'nudge' } : { kind: 'offTarget' };
    }
}

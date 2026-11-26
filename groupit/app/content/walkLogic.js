import * as MarkRegions from '../core/markRegions.js';
import { PlayBoard } from '../core/playBoard.js';
import { Mark } from '../core/types.js';
import * as W from './walkthrough.js';
export class WalkSession {
    lightFirst;
    replay;
    scene = -1;
    phase = 'arriving';
    board;
    seen = new Array(W.Count).fill(false);
    title = '';
    caption = '';
    ring = null;
    numberRing = -1;
    flashCell = -1;
    flashUntil = 0;
    celebrate = false;
    get buttonLabel() {
        return this.phase === 'done' ? (this.replay ? 'Done' : "Let's play") : null;
    }
    onHand = () => { };
    onHandStop = () => { };
    onChange = () => { };
    #done = false;
    #hinting = false;
    #hintCell = -1;
    #touchedAt = 0;
    #nudgedAt = 0;
    #refusedAt = -1000;
    #refusals = 0;
    #closeAt = 0;
    #nudging = false;
    constructor(options = {}) {
        this.lightFirst = options.lightFirst ?? false;
        this.replay = options.replay ?? false;
    }
    get current() { return W.Scenes[this.scene]; }
    get station() { return W.Stations[this.current.station]; }
    get isLast() { return this.scene === W.Count - 1; }
    get hinting() { return this.#hinting; }
    get hintCell() { return this.#hintCell; }
    get nudging() { return this.#nudging; }
    get sceneDone() { return this.#done; }
    go(index) {
        this.#stopNudge();
        this.scene = index;
        this.#done = false;
        this.#hinting = false;
        this.#hintCell = -1;
        this.#closeAt = 0;
        this.#refusals = 0;
        this.phase = 'arriving';
        this.celebrate = false;
        this.ring = null;
        this.numberRing = -1;
        this.flashCell = -1;
        const scene = this.current;
        const play = new PlayBoard(W.toPuzzle(this.station));
        const start = W.startOf(scene);
        for (let i = 0; i < start.length; i++)
            if (start[i] !== Mark.Unknown && !play.isLocked(i))
                play.put(i, start[i]);
        this.board = play;
        this.title = W.say(scene.title, this.lightFirst);
        const todo = this.#nextToDo();
        const line = scene.guided && todo >= 0 ? scene.moves[todo].say ?? scene.body : scene.body;
        this.caption = W.say(line, this.lightFirst);
        this.onChange();
    }
    arrived(now) {
        if (this.phase !== 'arriving')
            return;
        this.#lastNow = now;
        const scene = this.current;
        this.#touchedAt = now;
        this.#nudgedAt = scene.guided ? -100 : now;
        this.phase = 'waiting';
        this.#settle(-1, now);
        this.onChange();
    }
    rightCells() {
        const out = [];
        for (const m of this.current.moves)
            if (this.board.at(m.cell) === m.tone)
                out.push(m.cell);
        return out;
    }
    get readOnly() { return this.phase !== 'waiting'; }
    calloutLines() {
        const scene = this.current, st = this.station;
        const cells = st.rows * st.cols;
        const id = new Int32Array(cells), size = new Int32Array(cells), slot = new Int32Array(cells);
        MarkRegions.tag(this.board.marks, st.rows, st.cols, id, size, slot, this.board.puzzle);
        return scene.callouts.map((c) => {
            const text = this.#done && c.after !== null ? c.after : c.text;
            const n = c.cell >= 0 && c.cell < cells ? Math.max(1, size[c.cell]) : 1;
            return text.split('{n}').join(String(n));
        });
    }
    mark(cell, committed, gesture, refused, now) {
        if (this.scene < 0)
            return;
        this.#lastNow = now;
        if (!committed) {
            if (!refused || gesture !== 'press')
                return;
            if (this.phase !== 'waiting') {
                this.#flash(cell, now);
                this.onChange();
                return;
            }
            this.#refuse(cell, now);
            this.onChange();
            return;
        }
        if (this.phase !== 'waiting' || this.#done)
            return;
        this.#touchedAt = now;
        this.#refusals = 0;
        this.#stopNudge();
        this.#settle(cell, now);
        this.onChange();
    }
    tick(now) {
        if (this.flashCell >= 0 && now >= this.flashUntil) {
            this.flashCell = -1;
            this.onChange();
        }
        if (this.phase === 'closing') {
            if (now >= this.#closeAt)
                this.#advance();
            return;
        }
        if (this.phase !== 'waiting' || this.scene < 0 || this.#done)
            return;
        if (this.current.guided)
            this.#keepGuiding(now);
        else
            this.#watchTheSolve(now);
    }
    handFinished(now) {
        if (!this.#nudging)
            return;
        this.#nudging = false;
        this.#nudgedAt = now;
    }
    showHint() {
        if (this.scene < 0 || this.#done || this.phase !== 'waiting')
            return;
        for (const m of this.current.moves) {
            const have = this.board.at(m.cell);
            if (have !== Mark.Unknown && have !== m.tone)
                return;
        }
        this.#aim();
        this.onChange();
    }
    #hintFor() { const s = this.current; return s.hintAfter > 0 ? s.hintAfter : W.HintAfter; }
    #handFor() { const s = this.current; return s.handAfter > 0 ? s.handAfter : W.IdleWait; }
    #nextToDo() {
        const moves = this.current.moves;
        for (let i = 0; i < moves.length; i++)
            if (this.board.at(moves[i].cell) === Mark.Unknown)
                return i;
        return -1;
    }
    #settle(touched, now) {
        const scene = this.current;
        const lf = this.lightFirst;
        this.numberRing = -1;
        let wrong = -1;
        let all = true;
        for (const m of scene.moves) {
            const have = this.board.at(m.cell);
            if (have === m.tone)
                continue;
            all = false;
            if (have !== Mark.Unknown && wrong < 0)
                wrong = m.cell;
        }
        if (wrong >= 0 && touched >= 0 && this.board.at(touched) !== Mark.Unknown && W.asks(scene, touched) !== Mark.Unknown
            && this.board.at(touched) !== W.asks(scene, touched))
            wrong = touched;
        if (wrong >= 0) {
            const move = scene.moves.find((m) => m.cell === wrong);
            this.#hinting = true;
            this.#hintCell = wrong;
            this.#touchedAt = now - this.#hintFor();
            this.ring = { cell: wrong, style: 'slip' };
            const named = scene.counts ? W.nameTheGroup(this.board.puzzle, this.board.marks, wrong) : null;
            if (named !== null) {
                this.numberRing = named.badgeCell;
                this.caption = W.slipByNumbers(lf, move.tone, named.number, named.size, named.tone);
            }
            else {
                this.caption = W.say(move.wrong ?? scene.wrong, lf, move.tone);
            }
            return;
        }
        this.ring = null;
        if (all) {
            this.#finish(this.board.isSolved);
            return;
        }
        if (scene.guided) {
            this.#aim();
            return;
        }
        this.#hinting = false;
        this.#hintCell = -1;
        let moved = false;
        for (const m of scene.moves)
            if (this.board.at(m.cell) !== Mark.Unknown) {
                moved = true;
                break;
            }
        this.caption = W.say(moved && scene.going !== null ? scene.going : scene.body, lf);
    }
    #aim() {
        const next = this.#nextToDo();
        if (next < 0)
            return;
        const m = this.current.moves[next];
        this.#hinting = true;
        this.#hintCell = m.cell;
        this.ring = { cell: m.cell, style: 'target' };
        this.caption = W.say(m.say ?? this.current.body, this.lightFirst, m.tone);
    }
    #refuse(cell, now) {
        this.#flash(cell, now);
        if (now - this.#refusedAt > W.RefusalWindow)
            this.#refusals = 0;
        this.#refusedAt = now;
        this.#refusals++;
        if (this.current.guided)
            this.#touchedAt = Math.min(this.#touchedAt, now - this.#handFor());
        else if (!this.#hinting && this.#refusals >= 2)
            this.showHint();
    }
    #flash(cell, now) {
        this.flashCell = cell;
        this.flashUntil = now + W.RefusedFlash;
    }
    #finish(celebrate) {
        if (this.#done)
            return;
        this.#done = true;
        this.seen[this.scene] = true;
        this.#hinting = false;
        this.#hintCell = -1;
        this.#stopNudge();
        this.ring = null;
        this.numberRing = -1;
        const scene = this.current;
        if (scene.done !== null)
            this.caption = W.say(scene.done, this.lightFirst);
        this.celebrate = celebrate;
        if (this.isLast) {
            this.phase = 'done';
        }
        else {
            this.phase = 'closing';
            this.#closeAt = this.#lastNow + W.beat(scene);
        }
    }
    #advance() {
        if (this.phase !== 'closing')
            return;
        this.go(this.scene + 1);
    }
    #keepGuiding(now) {
        if (this.#nudging)
            return;
        if (now - this.#touchedAt < this.#handFor() || now - this.#nudgedAt < W.GuideRest)
            return;
        this.#showGhost();
    }
    #watchTheSolve(now) {
        const hint = this.#hintFor();
        if (!this.#hinting) {
            if (now - this.#touchedAt >= hint)
                this.showHint();
            return;
        }
        if (!this.#nudging && now - this.#touchedAt >= hint + W.IdleWait && now - this.#nudgedAt >= W.NudgeEvery)
            this.#showGhost();
    }
    #showGhost() {
        const cell = this.#hintCell;
        const want = cell >= 0 ? W.asks(this.current, cell) : Mark.Unknown;
        if (cell < 0 || this.board.at(cell) === want)
            return;
        this.#nudging = true;
        this.onHand({ cell, hold: W.isHold(want, this.lightFirst) });
    }
    #stopNudge() {
        if (!this.#nudging)
            return;
        this.#nudging = false;
        this.onHandStop();
    }
    #lastNow = 0;
}

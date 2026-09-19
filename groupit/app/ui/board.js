// The board, drawn to a canvas, and the gestures that play it.
//
// Canvas rather than DOM nodes: an 11x7 board is 77 cells each carrying a fill, a clue glyph and
// possibly a contradiction wash, and repainting that as elements on every tap is both slower and
// far more code than repainting it as pixels.
//
// WHAT THIS FILE IS NOT. It does not know the rules. Every verdict it paints — which cells are
// broken, whether the board is solved — comes from PlayBoard, which is the ported Core. A
// renderer that decided for itself what "wrong" means would be a third implementation of the
// rules, and there are already exactly two too many.
var _a;
import { isMargin, label as clueLabel } from '../core/clue.js';
import { Dir, Mark } from '../core/types.js';
import { Chrome, Slate } from './palette.js';
/** Layout numbers, in board units; the canvas scales them to whatever space it is given. */
const Pad = 0.34; // gutter width, in cells — where tally and turnstile clues print
const Gap = 0.055; // between cells, in cells
const Radius = 0.16; // cell corner radius, in cells
export class BoardView {
    canvas;
    /** Not readonly: the chapter page re-points one view at 154 boards. See `load`. */
    play;
    #ctx;
    #cell = 0;
    #originX = 0;
    #originY = 0;
    #dpr = 1;
    #onChange;
    /** Which margin gutters this board actually uses, so a board with none spends no space on them. */
    #padLeft = 0;
    #padTop = 0;
    /** The tone a drag is laying, so one swipe does not re-toggle every cell it crosses. */
    #strokeTone = Mark.Unknown;
    /** True once a press has moved off its first cell — a drag, and therefore not a tap. */
    #strokeActive = false;
    #lastCell = -1;
    #pointerDown = false;
    constructor(canvas, play, options = {}) {
        this.canvas = canvas;
        this.play = play;
        this.#onChange = options.onChange ?? (() => { });
        const ctx = canvas.getContext('2d');
        if (ctx === null)
            throw new Error('this browser gave no 2d canvas context');
        this.#ctx = ctx;
        this.#adopt(play);
        this.#bindInput();
    }
    /**
     * Point this view at a different board.
     *
     * The chapter page plays 154 boards through one canvas, and building a second BoardView over
     * the same element would bind a second set of pointer listeners to it — every tap then landing
     * twice, once per live view, with no way to take the first one's listeners off again. So the
     * view is built once and re-pointed.
     *
     * Everything the OLD board left behind goes with it. The margin gutters are per-board: a
     * board with tally clues reserves a left gutter, and keeping that reservation on a board
     * without them draws the grid offset from the cells the pointer maths thinks it is hitting.
     * And a load can land mid-press — a tile tapped while a finger is still down on the last
     * board — so the stroke state and any pending hold timer are dropped too, or the first
     * gesture on the new board finishes one that belonged to the old one.
     */
    load(play) {
        this.#adopt(play);
        this.resize();
    }
    #adopt(play) {
        this.play = play;
        this.#padLeft = 0;
        this.#padTop = 0;
        for (const c of play.puzzle.clues) {
            if (!isMargin(c))
                continue;
            if (c.col < 0)
                this.#padLeft = Pad; // a row clue prints to the left of the grid
            else
                this.#padTop = Pad; // a column clue prints above it
        }
        clearTimeout(this.#holdTimer);
        this.#holdTimer = undefined;
        this.#pointerDown = false;
        this.#held = false;
        this.#strokeActive = false;
        this.#strokeTone = Mark.Unknown;
        this.#startCell = -1;
        this.#lastCell = -1;
    }
    // ─────────────────────────────────────────────────────────────────── layout
    resize() {
        const parent = this.canvas.parentElement;
        const availW = (parent?.clientWidth ?? 320);
        // Leave the page's own chrome room; the board takes what is left of the viewport height.
        const availH = Math.max(220, window.innerHeight - 260);
        const unitsW = this.play.cols + this.#padLeft;
        const unitsH = this.play.rows + this.#padTop;
        this.#cell = Math.max(18, Math.min(availW / unitsW, availH / unitsH, 78));
        const w = this.#cell * unitsW;
        const h = this.#cell * unitsH;
        this.#dpr = Math.min(window.devicePixelRatio || 1, 3);
        this.canvas.width = Math.round(w * this.#dpr);
        this.canvas.height = Math.round(h * this.#dpr);
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.#originX = this.#padLeft * this.#cell;
        this.#originY = this.#padTop * this.#cell;
        this.paint();
    }
    #cellAt(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        const x = clientX - r.left - this.#originX;
        const y = clientY - r.top - this.#originY;
        const col = Math.floor(x / this.#cell);
        const row = Math.floor(y / this.#cell);
        if (row < 0 || row >= this.play.rows || col < 0 || col >= this.play.cols)
            return -1;
        return row * this.play.cols + col;
    }
    // ──────────────────────────────────────────────────────────────────── input
    //
    // The gesture model is BoardView.Apply's, from the app, because a sandbox that reimplements
    // "what a hold does" is a sandbox that will eventually teach the wrong thing:
    //
    //   tap   -> stroke(firstTone)   paints the tone into an empty cell, clears ANY tone
    //   hold  -> put(otherTone)      commits the other tone, or clears it if already there
    //
    // Stroke on the tap and Put on the hold is an asymmetry the C# argues for at length and this
    // must not "tidy" away: Stroke clears whatever is there and Put clears only its own tone, so
    // the CHEAP gesture is also the universal eraser.
    //
    // Two things the app has that a web page must add. A hold needs a real timer here — there is
    // no platform long-press to lean on, and `contextmenu` alone fires on desktop right-click but
    // not reliably under a thumb. And `firstTone` needs a visible control, because the app teaches
    // the hold over 1,072 boards and this page gets one: a visitor who cannot find Light by
    // tapping will decide the board is broken, not that they missed a gesture.
    /** Which tone a TAP paints. Mirrors Preferences.LightFirst; flipped by the page's tone toggle. */
    firstTone = Mark.Shadow;
    get otherTone() { return this.firstTone === Mark.Shadow ? Mark.Light : Mark.Shadow; }
    #holdTimer;
    #held = false;
    #startCell = -1;
    /** Long-press threshold. 450ms is under the 500ms most platforms use, so it fires first. */
    static HoldMs = 450;
    #bindInput() {
        const c = this.canvas;
        // touch-action none, or the browser claims the drag for scrolling and pull-to-refresh and
        // the board simply cannot be painted with a swipe on a phone.
        c.style.touchAction = 'none';
        c.addEventListener('pointerdown', (e) => {
            const idx = this.#cellAt(e.clientX, e.clientY);
            if (idx < 0)
                return;
            e.preventDefault();
            c.setPointerCapture(e.pointerId);
            this.#pointerDown = true;
            this.#held = false;
            this.#startCell = idx;
            this.#lastCell = idx;
            // A desktop right-click is the hold, immediately — nobody holds a mouse button down to
            // mean "the other tone".
            if (e.button === 2 || e.ctrlKey) {
                this.#held = true;
                if (this.play.put(idx, this.otherTone))
                    this.#changed();
                return;
            }
            this.#holdTimer = setTimeout(() => {
                this.#held = true;
                if (this.play.put(idx, this.otherTone)) {
                    this.#changed();
                    // A hold that lands should be felt, not just seen: on a phone the finger is covering
                    // the cell it just changed.
                    navigator.vibrate?.(12);
                }
            }, _a.HoldMs);
            // The tap itself is committed on pointerUP, not here, so a press that becomes a hold or a
            // drag does not also leave a tap behind it.
        });
        c.addEventListener('pointermove', (e) => {
            if (!this.#pointerDown)
                return;
            const idx = this.#cellAt(e.clientX, e.clientY);
            if (idx < 0 || idx === this.#lastCell)
                return;
            // Moving off the first cell is a drag, so it is not a hold and never was.
            clearTimeout(this.#holdTimer);
            if (this.#strokeTone === Mark.Unknown && !this.#held) {
                // The drag's first step decides what the whole drag does, from the state the START cell
                // was in — paint if it was empty, erase if it was not. Deciding per cell instead would
                // make one swipe toggle every cell it crosses, which is unusable.
                const startWasEmpty = this.play.at(this.#startCell) === Mark.Unknown;
                this.#strokeTone = startWasEmpty ? this.firstTone : Mark.Unknown;
                this.#strokeActive = true;
                if (startWasEmpty && this.play.stroke(this.#startCell, this.firstTone))
                    this.#changed();
            }
            this.#lastCell = idx;
            if (!this.#strokeActive)
                return;
            const want = this.#strokeTone;
            const now = this.play.at(idx);
            let moved = false;
            if (want === Mark.Unknown)
                moved = now !== Mark.Unknown && this.play.stroke(idx, now);
            else
                moved = now === Mark.Unknown && this.play.stroke(idx, want);
            if (moved)
                this.#changed();
        });
        const release = (e) => {
            if (!this.#pointerDown)
                return;
            clearTimeout(this.#holdTimer);
            // A press that neither held nor dragged is a tap, and only now is that known.
            if (!this.#held && !this.#strokeActive && this.#startCell >= 0) {
                if (this.play.stroke(this.#startCell, this.firstTone))
                    this.#changed();
            }
            this.#pointerDown = false;
            this.#held = false;
            this.#strokeActive = false;
            this.#strokeTone = Mark.Unknown;
            this.#startCell = -1;
            this.#lastCell = -1;
            if (c.hasPointerCapture(e.pointerId))
                c.releasePointerCapture(e.pointerId);
        };
        c.addEventListener('pointerup', release);
        c.addEventListener('pointercancel', release);
        // The browser menu would otherwise land on top of the board on every right-click.
        c.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    #changed() {
        this.paint();
        this.#onChange();
    }
    undo() { if (this.play.undo().ok)
        this.#changed(); }
    reset() { this.play.reset(); this.#changed(); }
    // ───────────────────────────────────────────────────────────────── painting
    paint() {
        const ctx = this.#ctx;
        const { rows, cols } = this.play;
        const cell = this.#cell;
        const status = this.play.status;
        ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const gap = cell * Gap;
        const radius = cell * Radius;
        const dark = document.documentElement.classList.contains('night');
        // ── cells
        for (let i = 0; i < rows * cols; i++) {
            const r = Math.floor(i / cols), c = i % cols;
            const x = this.#originX + c * cell + gap / 2;
            const y = this.#originY + r * cell + gap / 2;
            const s = cell - gap;
            if (this.play.puzzle.isVoid(i))
                continue; // a hole is not a cell; draw nothing at all
            const mark = this.play.at(i);
            const locked = this.play.isLocked(i);
            const fill = mark === Mark.Unknown ? Slate.unknown
                : mark === Mark.Shadow ? (locked ? Slate.givenInk : Slate.ink)
                    : mark === Mark.Gold ? Slate.accent
                        : (locked ? Slate.givenLit : Slate.lit);
            ctx.fillStyle = fill;
            this.#roundRect(x, y, s, s, radius);
            ctx.fill();
            // A contradiction is a wash OVER the cell, never a change of its tone — the player must
            // still be able to read what they marked while the board is telling them it cannot work.
            if (status.cellBroken[i] !== 0) {
                ctx.fillStyle = this.#brokenWash(fill);
                this.#roundRect(x, y, s, s, radius);
                ctx.fill();
            }
        }
        // ── clue glyphs
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let k = 0; k < this.play.puzzle.clues.length; k++) {
            const clue = this.play.puzzle.clues[k];
            const broken = status.clueBroken[k] !== 0;
            if (isMargin(clue))
                this.#paintMarginClue(clue, broken, dark);
            else
                this.#paintCellClue(clue, broken);
        }
    }
    #paintCellClue(clue, broken) {
        const ctx = this.#ctx;
        const cell = this.#cell;
        const idx = clue.row * this.play.cols + clue.col;
        const x = this.#originX + clue.col * cell + cell / 2;
        const y = this.#originY + clue.row * cell + cell / 2;
        const mark = this.play.at(idx);
        const onLight = mark === Mark.Light || mark === Mark.Gold;
        const ground = mark === Mark.Unknown ? Slate.unknown : onLight ? Slate.lit : Slate.ink;
        ctx.fillStyle = broken ? (onLight ? Chrome.brokenOnLight : Chrome.brokenOnDark)
            : ground === Slate.unknown ? Slate.lit : (onLight ? Slate.ink : Slate.lit);
        const text = clueLabel(clue);
        // Two-character labels (a twin's "=A", a region clue past nine) get a step down rather than
        // a squeeze, so the digit height stays comparable across the board.
        ctx.font = `600 ${Math.round(cell * (text.length > 1 ? 0.38 : 0.46))}px ui-rounded, "Nunito", system-ui, sans-serif`;
        ctx.fillText(text, x, y + cell * 0.02);
        // A line or twice-told clue also points: the number is about the ray, not the cell.
        if (clue.kind === 1 /* Line */ || clue.kind === 12 /* Double */)
            this.#paintArrow(clue, x, y, ctx.fillStyle);
    }
    #paintArrow(clue, cx, cy, colour) {
        const ctx = this.#ctx;
        const cell = this.#cell;
        const d = cell * 0.30;
        const t = cell * 0.10;
        const dx = clue.dir === Dir.Right ? 1 : clue.dir === Dir.Left ? -1 : 0;
        const dy = clue.dir === Dir.Down ? 1 : clue.dir === Dir.Up ? -1 : 0;
        ctx.save();
        ctx.translate(cx + dx * d, cy + dy * d);
        ctx.rotate(Math.atan2(dy, dx));
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.moveTo(t, 0);
        ctx.lineTo(-t * 0.6, t * 0.7);
        ctx.lineTo(-t * 0.6, -t * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    #paintMarginClue(clue, broken, dark) {
        const ctx = this.#ctx;
        const cell = this.#cell;
        const row = clue.col < 0;
        const x = row ? this.#originX - Pad * cell / 2 : this.#originX + clue.col * cell + cell / 2;
        const y = row ? this.#originY + clue.row * cell + cell / 2 : this.#originY - Pad * cell / 2;
        ctx.fillStyle = broken ? (dark ? Chrome.brokenOnDark : Chrome.brokenOnLight)
            : (dark ? Chrome.inkNight : Chrome.inkDay);
        ctx.font = `700 ${Math.round(cell * 0.34)}px ui-rounded, "Nunito", system-ui, sans-serif`;
        ctx.fillText(clueLabel(clue), x, y);
    }
    /** The contradiction wash: the broken ink for this ground, at the alpha the app uses. */
    #brokenWash(ground) {
        const light = ground === Slate.lit || ground === Slate.givenLit || ground === Slate.accent;
        return (light ? Chrome.brokenOnLight : Chrome.brokenOnDark) + '44';
    }
    #roundRect(x, y, w, h, r) {
        const ctx = this.#ctx;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
    }
}
_a = BoardView;
//# sourceMappingURL=board.js.map
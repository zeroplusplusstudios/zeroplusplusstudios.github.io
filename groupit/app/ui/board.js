var _a;
import { isMargin, label as clueLabel, namesItsPatchSize } from '../core/clue.js';
import * as MarkRegions from '../core/markRegions.js';
import { ClueKind, Dir, Mark } from '../core/types.js';
import { Board, Chrome, Slate, brokenInk, groupInk, mix } from './palette.js';
const CellShare = 0.94;
const Rim = 0.16;
const CardRadius = 0.26;
const CellRadius = 0.16;
const MarginIcon = 0.66 * CellShare;
const MarginGap = 0.06;
const MarginDepth = MarginIcon + MarginGap;
const MaxPitch = 78;
const ClueDigit = 0.42;
const ClueTopInset = 0.26;
const BadgeInset = 0.06;
const BadgeDigit = 0.26;
const BadgeFloorPx = 11;
const WatchInset = 0.05, WatchRing = 0.42, WatchDigit = 0.30;
const WatchWall = 7 / 96, WatchWallLanded = 11 / 96;
const FlagWall = 0.055;
const HoleWall = 0.035;
const Face = '"Nunito", ui-rounded, system-ui, sans-serif';
const FillMs = 170;
const RingDelayMs = 90;
function reducedMotion() {
    try {
        return matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    catch {
        return false;
    }
}
function sameMarks(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i])
            return false;
    return true;
}
function coarsePointer() {
    try {
        return matchMedia('(pointer: coarse)').matches;
    }
    catch {
        return false;
    }
}
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const GroupBandMs = 460, BoardBandMs = 820;
const GroupBandHalf = 1.55, BoardBandHalf = 2.35, BandCoreFraction = 0.29;
const GlintLift = 0.09;
const SheenOnDark = [255, 244, 228, 0x1c / 255];
const SheenOnLight = [51, 41, 28, 0x62 / 255];
function bandProfile(d, core, half) {
    if (d <= core)
        return 1;
    if (d >= half)
        return 0;
    const t = (d - core) / (half - core);
    return 1 - t * t * (3 - 2 * t);
}
export class BoardView {
    canvas;
    play;
    #ctx;
    #dpr = 1;
    #onChange;
    #onMark;
    #pitch = 0;
    #cardX = 0;
    #cardY = 0;
    #gridX = 0;
    #gridY = 0;
    #w = 0;
    #h = 0;
    #bandLeft = false;
    #bandTop = false;
    #laidW = -1;
    #laidH = -1;
    #laidLandscape = null;
    #probe = null;
    #strokeTone = Mark.Unknown;
    #strokeActive = false;
    #lastCell = -1;
    #pointerDown = false;
    #readOnly = false;
    #viewLocks = new Set();
    #rings = new Map();
    #counts = true;
    #toneListeners = new Set();
    #shown = new Uint8Array(0);
    #tweens = new Map();
    #press = null;
    #raf = 0;
    #groupId = new Int32Array(0);
    #groupSize = new Int32Array(0);
    #groupSlot = new Int32Array(0);
    #labelCell = new Int32Array(0);
    #closed = new Set();
    #closedNow = new Set();
    #seedLedger = true;
    #cause = null;
    #settled = new Uint8Array(0);
    #wasSolved = false;
    #sizeClueAt = new Int32Array(0);
    #band = null;
    constructor(canvas, play, options = {}) {
        this.canvas = canvas;
        this.play = play;
        this.#onChange = options.onChange ?? (() => { });
        this.#onMark = options.onMark;
        this.#counts = options.counts ?? true;
        const ctx = canvas.getContext('2d');
        if (ctx === null)
            throw new Error('this browser gave no 2d canvas context');
        this.#ctx = ctx;
        this.#adopt(play);
        this.#bindInput();
        this.#repaintWhenFontsArrive();
    }
    load(play) {
        this.#adopt(play);
        this.#laidW = -1;
        this.resize();
    }
    #adopt(play) {
        this.play = play;
        this.#bandLeft = false;
        this.#bandTop = false;
        for (const c of play.puzzle.clues) {
            if (!isMargin(c))
                continue;
            if (c.col < 0)
                this.#bandLeft = true;
            else
                this.#bandTop = true;
        }
        clearTimeout(this.#holdTimer);
        this.#holdTimer = undefined;
        this.#pointerDown = false;
        this.#held = false;
        this.#strokeActive = false;
        this.#strokeTone = Mark.Unknown;
        this.#startCell = -1;
        this.#lastCell = -1;
        this.#press = null;
        this.#readOnly = false;
        this.#viewLocks.clear();
        this.#rings.clear();
        this.#tweens.clear();
        this.#shown = Uint8Array.from(play.marks);
        const n = play.cellCount;
        this.#groupId = new Int32Array(n);
        this.#groupSize = new Int32Array(n);
        this.#groupSlot = new Int32Array(n);
        this.#labelCell = new Int32Array(n);
        this.#closed.clear();
        this.#closedNow.clear();
        this.#seedLedger = true;
        this.#cause = null;
        this.#settled = new Uint8Array(0);
        this.#wasSolved = play.isSolved;
        this.#band = null;
        this.#sizeClueAt = new Int32Array(n).fill(-1);
        play.puzzle.clues.forEach((c, k) => {
            if (!isMargin(c) && namesItsPatchSize(c))
                this.#sizeClueAt[c.row * play.cols + c.col] = k;
        });
    }
    resize() {
        const parent = this.canvas.parentElement;
        let availW = (parent?.clientWidth ?? 320);
        if (parent !== null) {
            const style = getComputedStyle(parent);
            availW -= (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
        }
        availW = Math.floor(availW);
        const landscape = window.innerWidth > window.innerHeight;
        const stableH = this.#stableHeight();
        const heightMatters = !coarsePointer();
        if (this.#laidW === availW && this.#laidLandscape === landscape &&
            (!heightMatters || this.#laidH === stableH) && this.#pitch > 0)
            return;
        this.#laidW = availW;
        this.#laidH = stableH;
        this.#laidLandscape = landscape;
        const availH = Math.max(220, stableH - 260);
        const bandW = this.#bandLeft ? MarginDepth : 0;
        const bandH = this.#bandTop ? MarginDepth : 0;
        const unitsW = this.play.cols + 2 * Rim + bandW;
        const unitsH = this.play.rows + 2 * Rim + bandH;
        const pitch = Math.max(18, Math.min(availW / unitsW, availH / unitsH, MaxPitch));
        this.#pitch = pitch;
        const w = Math.floor(pitch * unitsW);
        const h = Math.floor(pitch * unitsH);
        this.#w = w;
        this.#h = h;
        this.#dpr = Math.min(window.devicePixelRatio || 1, 3);
        this.canvas.width = Math.round(w * this.#dpr);
        this.canvas.height = Math.round(h * this.#dpr);
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        this.#cardX = bandW * pitch;
        this.#cardY = bandH * pitch;
        this.#gridX = this.#cardX + Rim * pitch;
        this.#gridY = this.#cardY + Rim * pitch;
        this.paint();
    }
    #stableHeight() {
        try {
            if (this.#probe === null && typeof CSS !== 'undefined' && CSS.supports?.('height', '100svh')) {
                const p = document.createElement('div');
                p.setAttribute('aria-hidden', 'true');
                p.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
                document.body.appendChild(p);
                this.#probe = p;
            }
            const h = this.#probe?.offsetHeight ?? 0;
            if (h > 0)
                return h;
        }
        catch { }
        return window.innerHeight;
    }
    cellAt(clientX, clientY) { return this.#cellAt(clientX, clientY); }
    #cellAt(clientX, clientY) {
        if (this.#pitch <= 0)
            return -1;
        const r = this.canvas.getBoundingClientRect();
        const k = r.width > 0 && this.#w > 0 ? r.width / this.#w : 1;
        const x = (clientX - r.left) / k - this.#gridX;
        const y = (clientY - r.top) / k - this.#gridY;
        const col = Math.floor(x / this.#pitch);
        const row = Math.floor(y / this.#pitch);
        if (row < 0 || row >= this.play.rows || col < 0 || col >= this.play.cols)
            return -1;
        return row * this.play.cols + col;
    }
    cellRect(cell) {
        if (cell < 0 || cell >= this.play.cellCount || this.#pitch <= 0)
            return null;
        const r = this.canvas.getBoundingClientRect();
        const k = r.width > 0 && this.#w > 0 ? r.width / this.#w : 1;
        const { x, y, s } = this.#cellBox(cell);
        return new DOMRect(r.left + x * k, r.top + y * k, s * k, s * k);
    }
    #cellBox(i) {
        const p = this.#pitch;
        const cols = this.play.cols;
        const r = Math.floor(i / cols), c = i % cols;
        const gap = p * (1 - CellShare);
        return { x: this.#gridX + c * p + gap / 2, y: this.#gridY + r * p + gap / 2, s: p * CellShare };
    }
    get readOnly() { return this.#readOnly; }
    set readOnly(on) {
        this.#readOnly = on;
        if (on)
            this.#cancelPress();
    }
    lockCell(cell, locked) {
        if (locked)
            this.#viewLocks.add(cell);
        else
            this.#viewLocks.delete(cell);
    }
    unlockAll() { this.#viewLocks.clear(); }
    ring(cell, style) {
        if (style === null)
            this.#rings.delete(cell);
        else
            this.#rings.set(cell, style);
        this.paint();
    }
    clearRings() {
        if (this.#rings.size === 0)
            return;
        this.#rings.clear();
        this.paint();
    }
    get counts() { return this.#counts; }
    set counts(on) {
        if (this.#counts === on)
            return;
        this.#counts = on;
        this.paint();
    }
    setTapTone(tone) { this.firstTone = tone; }
    onTapTone(listener) {
        this.#toneListeners.add(listener);
        return () => { this.#toneListeners.delete(listener); };
    }
    #canMark(i) {
        return !this.#readOnly && !this.#viewLocks.has(i) && !this.play.isLocked(i) && !this.play.puzzle.isVoid(i);
    }
    #emit(cell, tone, committed, gesture, refused) {
        if (this.#onMark === undefined)
            return;
        try {
            this.#onMark(cell, tone, committed, { gesture, refused });
        }
        catch (e) {
            console.error(e);
        }
    }
    #tryStroke(i, tone, gesture, report = true) {
        const intended = this.play.at(i) === Mark.Unknown ? tone : Mark.Unknown;
        if (!this.#canMark(i)) {
            if (report)
                this.#emit(i, intended, false, gesture, true);
            return false;
        }
        if (!this.play.stroke(i, tone))
            return false;
        this.#emit(i, this.play.at(i), true, gesture, false);
        return true;
    }
    #tryPut(i, tone, gesture) {
        const intended = this.play.at(i) === tone ? Mark.Unknown : tone;
        if (!this.#canMark(i)) {
            this.#emit(i, intended, false, gesture, true);
            return false;
        }
        if (!this.play.put(i, tone))
            return false;
        this.#emit(i, this.play.at(i), true, gesture, false);
        return true;
    }
    #firstTone = Mark.Shadow;
    get firstTone() { return this.#firstTone; }
    set firstTone(tone) {
        if (tone === this.#firstTone)
            return;
        this.#firstTone = tone;
        for (const fn of this.#toneListeners) {
            try {
                fn(tone);
            }
            catch (e) {
                console.error(e);
            }
        }
    }
    get otherTone() { return this.firstTone === Mark.Shadow ? Mark.Light : Mark.Shadow; }
    #holdTimer;
    #held = false;
    #startCell = -1;
    static HoldMs = 450;
    #cancelPress() {
        if (this.#press === null)
            return;
        this.#press = null;
        this.paint();
    }
    #bindInput() {
        const c = this.canvas;
        c.style.touchAction = 'none';
        c.addEventListener('pointerdown', (e) => {
            const idx = this.#cellAt(e.clientX, e.clientY);
            if (idx < 0)
                return;
            e.preventDefault();
            try {
                c.setPointerCapture(e.pointerId);
            }
            catch { }
            this.#pointerDown = true;
            this.#held = false;
            this.#startCell = idx;
            this.#lastCell = idx;
            const markable = this.#canMark(idx);
            this.#emit(idx, this.play.at(idx) === Mark.Unknown ? this.firstTone : Mark.Unknown, false, 'press', !markable);
            if (e.button === 2 || e.ctrlKey) {
                this.#held = true;
                if (this.#tryPut(idx, this.otherTone, 'hold'))
                    this.#changed();
                return;
            }
            if (markable) {
                this.#press = { cell: idx, at: performance.now() };
                this.paint();
            }
            this.#holdTimer = setTimeout(() => {
                this.#held = true;
                this.#press = null;
                if (this.#tryPut(idx, this.otherTone, 'hold')) {
                    this.#changed();
                    if (navigator.userActivation?.hasBeenActive !== false)
                        navigator.vibrate?.(12);
                }
                else {
                    this.paint();
                }
            }, _a.HoldMs);
        });
        c.addEventListener('pointermove', (e) => {
            if (!this.#pointerDown)
                return;
            const idx = this.#cellAt(e.clientX, e.clientY);
            if (idx < 0 || idx === this.#lastCell)
                return;
            clearTimeout(this.#holdTimer);
            if (this.#press !== null)
                this.#cancelPress();
            if (this.#readOnly) {
                this.#lastCell = idx;
                return;
            }
            if (this.#strokeTone === Mark.Unknown && !this.#held) {
                const startWasEmpty = this.play.at(this.#startCell) === Mark.Unknown;
                this.#strokeTone = startWasEmpty ? this.firstTone : Mark.Unknown;
                this.#strokeActive = true;
                if (startWasEmpty && this.#tryStroke(this.#startCell, this.firstTone, 'drag', false))
                    this.#changed();
            }
            this.#lastCell = idx;
            if (!this.#strokeActive)
                return;
            const want = this.#strokeTone;
            const now = this.play.at(idx);
            let moved = false;
            if (want === Mark.Unknown)
                moved = now !== Mark.Unknown && this.#tryStroke(idx, now, 'drag', false);
            else
                moved = now === Mark.Unknown && this.#tryStroke(idx, want, 'drag', false);
            if (moved)
                this.#changed();
        });
        const release = (e) => {
            if (!this.#pointerDown)
                return;
            clearTimeout(this.#holdTimer);
            if (!this.#held && !this.#strokeActive && this.#startCell >= 0) {
                if (this.#tryStroke(this.#startCell, this.firstTone, 'tap')) {
                    this.#press = null;
                    this.#changed();
                    if (navigator.userActivation?.hasBeenActive !== false)
                        navigator.vibrate?.(8);
                }
            }
            this.#pointerDown = false;
            this.#held = false;
            this.#strokeActive = false;
            this.#strokeTone = Mark.Unknown;
            this.#startCell = -1;
            this.#lastCell = -1;
            if (this.#press !== null)
                this.#cancelPress();
            try {
                if (c.hasPointerCapture(e.pointerId))
                    c.releasePointerCapture(e.pointerId);
            }
            catch { }
        };
        c.addEventListener('pointerup', release);
        c.addEventListener('pointercancel', release);
        c.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    #changed(cause = 'move') {
        this.#cause = cause;
        this.paint();
        this.#onChange();
    }
    undo() { if (this.play.undo().ok)
        this.#changed('undo'); }
    reset() { this.play.reset(); this.#closed.clear(); this.#changed('incidental'); }
    #repaintWhenFontsArrive() {
        try {
            const fonts = document.fonts;
            if (fonts === undefined)
                return;
            Promise.all([fonts.load(`600 20px Nunito`), fonts.load(`700 20px Nunito`)])
                .catch(() => [])
                .then(() => fonts.ready)
                .then(() => { if (this.#pitch > 0)
                this.paint(); })
                .catch(() => { });
        }
        catch { }
    }
    #fillOf(mark) {
        return mark === Mark.Unknown ? Slate.unknown
            : mark === Mark.Shadow ? Slate.ink
                : mark === Mark.Gold ? Slate.accent
                    : Slate.lit;
    }
    paint() {
        if (this.#pitch <= 0)
            return;
        const ctx = this.#ctx;
        const { rows, cols } = this.play;
        const cells = rows * cols;
        const p = this.#pitch;
        const status = this.play.status;
        const marks = this.play.marks;
        const now = performance.now();
        const still = reducedMotion();
        if (this.#shown.length !== marks.length)
            this.#shown = Uint8Array.from(marks);
        for (let i = 0; i < cells; i++) {
            if (marks[i] === this.#shown[i])
                continue;
            if (!still)
                this.#tweens.set(i, { from: this.#fillOf(this.#shown[i]), at: now });
            this.#shown[i] = marks[i];
        }
        ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
        ctx.clearRect(0, 0, this.#w, this.#h);
        ctx.fillStyle = Board.card;
        this.#roundRect(this.#cardX, this.#cardY, this.#w - this.#cardX, this.#h - this.#cardY, CardRadius * p);
        ctx.fill();
        const groups = MarkRegions.tag(marks, rows, cols, this.#groupId, this.#groupSize, this.#groupSlot, this.play.puzzle);
        if (this.#counts)
            MarkRegions.labelCells(this.#groupId, cells, groups, this.play.puzzle, this.#labelCell);
        if (!sameMarks(marks, this.#settled)) {
            this.#settle(groups, status, now, still);
            this.#settled = Uint8Array.from(marks);
        }
        this.#cause = null;
        const band = this.#band;
        let bandAt = 0;
        if (band !== null) {
            const t = (now - band.at) / band.ms;
            if (t >= 1)
                this.#band = null;
            else
                bandAt = band.from + (band.to - band.from) * Math.max(0, t);
        }
        let animating = false;
        for (let i = 0; i < cells; i++) {
            const { x, y, s } = this.#cellBox(i);
            const radius = s * CellRadius;
            if (this.play.puzzle.isVoid(i)) {
                ctx.save();
                ctx.strokeStyle = Board.holeRim;
                ctx.lineWidth = Math.max(1, s * HoleWall);
                ctx.setLineDash([s * 0.12, s * 0.09]);
                const inset = ctx.lineWidth / 2;
                this.#roundRect(x + inset, y + inset, s - 2 * inset, s - 2 * inset, radius);
                ctx.stroke();
                ctx.restore();
                continue;
            }
            const mark = marks[i];
            let fill = this.#fillOf(mark);
            if (status.cellBroken[i] !== 0)
                fill = mix(fill, Board.broken, Board.brokenWash);
            const tween = this.#tweens.get(i);
            if (tween !== undefined) {
                const t = Math.min(1, (now - tween.at) / FillMs);
                if (t >= 1)
                    this.#tweens.delete(i);
                else {
                    animating = true;
                    ctx.fillStyle = tween.from;
                    this.#roundRect(x, y, s, s, radius);
                    ctx.fill();
                    const k = 0.55 + 0.45 * easeOut(t);
                    const d = s * (1 - k) / 2;
                    ctx.fillStyle = fill;
                    this.#roundRect(x + d, y + d, s * k, s * k, radius * k);
                    ctx.fill();
                }
            }
            if (this.#tweens.get(i) === undefined) {
                ctx.fillStyle = fill;
                this.#roundRect(x, y, s, s, radius);
                ctx.fill();
            }
            if (band !== null && this.#band !== null && band.mask[i] !== 0) {
                const u = Math.floor(i / cols) + (i % cols);
                const amount = bandProfile(Math.abs(u - bandAt), band.half * BandCoreFraction, band.half);
                animating = true;
                if (amount > 0.002) {
                    const g = s * band.lift * amount / 2;
                    ctx.fillStyle = fill;
                    this.#roundRect(x - g, y - g, s + 2 * g, s + 2 * g, radius);
                    ctx.fill();
                    const lightGround = mark === Mark.Light || mark === Mark.Gold;
                    const [r, gr, b, a] = lightGround ? SheenOnLight : SheenOnDark;
                    ctx.fillStyle = `rgba(${r},${gr},${b},${(a * amount).toFixed(3)})`;
                    this.#roundRect(x - g, y - g, s + 2 * g, s + 2 * g, radius);
                    ctx.fill();
                }
            }
        }
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let k = 0; k < this.play.puzzle.clues.length; k++) {
            const clue = this.play.puzzle.clues[k];
            const broken = status.clueBroken[k] !== 0;
            if (isMargin(clue))
                this.#paintMarginClue(clue, broken);
            else
                this.#paintCellClue(clue, broken);
        }
        if (this.#counts) {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            for (let i = 0; i < cells; i++) {
                const g = this.#groupId[i];
                if (g === MarkRegions.None || this.#groupSize[i] === 0 || this.#labelCell[g] !== i)
                    continue;
                const { x, y, s } = this.#cellBox(i);
                const mark = marks[i];
                const light = mark === Mark.Light || mark === Mark.Gold;
                ctx.fillStyle = groupInk(light, this.#groupSlot[i]);
                ctx.font = `600 ${Math.round(Math.max(BadgeFloorPx, s * BadgeDigit))}px ${Face}`;
                ctx.fillText(String(this.#groupSize[i]), x + s * BadgeInset, y + s * BadgeInset);
            }
        }
        const press = this.#press;
        if (press !== null) {
            const { x, y, s } = this.#cellBox(press.cell);
            const mark = marks[press.cell];
            const light = mark === Mark.Light || mark === Mark.Gold;
            ctx.fillStyle = light ? 'rgba(21,23,28,0.16)' : 'rgba(255,255,255,0.16)';
            this.#roundRect(x, y, s, s, s * CellRadius);
            ctx.fill();
            const elapsed = now - press.at;
            if (!still && elapsed >= RingDelayMs) {
                const t = Math.min(1, (elapsed - RingDelayMs) / (_a.HoldMs - RingDelayMs));
                const cx = x + s / 2, cy = y + s / 2, r = s * 0.34;
                ctx.lineWidth = Math.max(2, s * 0.085);
                ctx.lineCap = 'round';
                ctx.strokeStyle = light ? 'rgba(21,23,28,0.18)' : 'rgba(255,255,255,0.22)';
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
                const tone = this.#fillOf(this.play.at(press.cell) === this.otherTone ? Mark.Unknown : this.otherTone);
                ctx.strokeStyle = tone;
                ctx.beginPath();
                ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
                ctx.stroke();
                ctx.lineCap = 'butt';
            }
            animating = true;
        }
        for (const [cell, style] of this.#rings) {
            if (cell < 0 || cell >= cells)
                continue;
            const { x, y, s } = this.#cellBox(cell);
            const mark = marks[cell];
            const light = mark === Mark.Light || mark === Mark.Gold;
            ctx.save();
            let width = Math.max(2, s * 0.08);
            if (style === 'slip')
                ctx.strokeStyle = brokenInk(light);
            else if (style === 'focus')
                ctx.strokeStyle = Chrome.panelDay;
            else {
                ctx.strokeStyle = Board.star;
                ctx.shadowColor = Board.star;
                ctx.shadowBlur = s * 0.18;
                if (!still) {
                    width *= 0.8 + 0.35 * (0.5 + 0.5 * Math.sin(now / 260));
                    animating = true;
                }
            }
            ctx.lineWidth = width;
            const inset = width / 2;
            this.#roundRect(x + inset, y + inset, s - width, s - width, Math.max(0, s * CellRadius - inset / 2));
            ctx.stroke();
            ctx.restore();
        }
        if (animating)
            this.#schedule();
    }
    #settle(groups, status, now, still) {
        const cells = this.play.cellCount;
        const anchor = new Int32Array(groups).fill(-1);
        const hit = new Uint8Array(groups), broken = new Uint8Array(groups);
        for (let i = 0; i < cells; i++) {
            const g = this.#groupId[i];
            if (g === MarkRegions.None)
                continue;
            if (anchor[g] < 0)
                anchor[g] = i;
            const k = this.#sizeClueAt[i];
            if (k < 0)
                continue;
            if (status.patchBroken[i] !== 0)
                broken[g] = 1;
            if (this.play.puzzle.clues[k].value === this.#groupSize[i])
                hit[g] = 1;
        }
        const undo = this.#cause === 'undo';
        const silent = this.#seedLedger || this.#cause === null || this.#cause === 'incidental';
        this.#seedLedger = false;
        const closingNow = new Set();
        const announce = [];
        for (let g = 0; g < groups; g++) {
            if (hit[g] === 0 || broken[g] !== 0)
                continue;
            const sig = anchor[g] * (cells + 1) + this.#groupSize[anchor[g]];
            closingNow.add(sig);
            const first = !this.#closed.has(sig);
            this.#closed.add(sig);
            if (silent)
                continue;
            if (!undo && first)
                announce.push(g);
            else if (undo && !this.#closedNow.has(sig))
                announce.push(g);
        }
        this.#closedNow = closingNow;
        const solvedNow = status.solved && !this.#wasSolved;
        this.#wasSolved = status.solved;
        if (still || silent)
            return;
        if (solvedNow) {
            const mask = new Uint8Array(cells);
            for (let i = 0; i < cells; i++)
                if (!this.play.puzzle.isVoid(i))
                    mask[i] = 1;
            this.#startBand(mask, BoardBandMs, BoardBandHalf, GlintLift * 0.55, now);
        }
        else if (announce.length > 0 && !status.solved) {
            const mask = new Uint8Array(cells);
            const wanted = new Set(announce);
            for (let i = 0; i < cells; i++)
                if (wanted.has(this.#groupId[i]))
                    mask[i] = 1;
            this.#startBand(mask, GroupBandMs, GroupBandHalf, GlintLift, now);
        }
    }
    #startBand(mask, ms, half, lift, now) {
        const cols = this.play.cols;
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i < mask.length; i++) {
            if (mask[i] === 0)
                continue;
            const u = Math.floor(i / cols) + (i % cols);
            if (u < lo)
                lo = u;
            if (u > hi)
                hi = u;
        }
        if (lo === Infinity)
            return;
        this.#band = { mask, at: now, ms, half, lift, from: lo - half, to: hi + half };
        this.#schedule();
    }
    #schedule() {
        if (this.#raf !== 0)
            return;
        this.#raf = requestAnimationFrame(() => { this.#raf = 0; this.paint(); });
    }
    #paintCellClue(clue, broken) {
        const ctx = this.#ctx;
        const idx = clue.row * this.play.cols + clue.col;
        const { x, y, s } = this.#cellBox(idx);
        const mark = this.play.at(idx);
        const lightGround = mark === Mark.Light || mark === Mark.Gold;
        const ink = broken ? brokenInk(lightGround)
            : mark === Mark.Light ? Slate.ink
                : mark === Mark.Gold ? Board.textOnGold
                    : Slate.lit;
        const weight = this.play.isLocked(idx) ? 700 : 600;
        if (broken) {
            ctx.strokeStyle = ink;
            ctx.lineWidth = Math.max(1.5, s * FlagWall);
            const inset = ctx.lineWidth / 2;
            this.#roundRect(x + inset, y + inset, s - 2 * inset, s - 2 * inset, s * CellRadius - inset / 2);
            ctx.stroke();
        }
        const text = clueLabel(clue);
        const cx = x + s / 2;
        const lower = this.#counts ? ClueTopInset : 0;
        if (clue.kind === ClueKind.Watch) {
            const landed = this.#watchLanded(idx);
            const d = s * WatchRing;
            const rcx = x + s * WatchInset + d / 2, rcy = y + s - s * WatchInset - d / 2;
            const wall = d * (landed ? WatchWallLanded : WatchWall);
            ctx.strokeStyle = landed && !broken ? (lightGround ? '#8A5A00' : Board.star) : ink;
            ctx.lineWidth = Math.max(1, wall);
            ctx.beginPath();
            ctx.arc(rcx, rcy, d / 2 - wall / 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = ink;
            ctx.font = `600 ${Math.round(s * WatchDigit)}px ${Face}`;
            ctx.fillText(text, rcx, rcy + s * 0.01);
            return;
        }
        ctx.fillStyle = ink;
        const arrow = clue.kind === ClueKind.Line || clue.kind === ClueKind.Double;
        const size = Math.round(s * (text.length > 1 ? 0.36 : ClueDigit));
        if (arrow) {
            this.#paintArrow(clue, cx, y + s * 0.06 + s * 0.13, s, ink);
            ctx.font = `italic ${weight} ${size}px ${Face}`;
            ctx.fillText(text, cx, y + s * 0.68);
            return;
        }
        ctx.font = `${weight} ${size}px ${Face}`;
        ctx.fillText(text, cx, y + s * (lower + (1 - lower) / 2) + s * 0.01);
    }
    #watchLanded(cell) {
        for (let d = 0; d < 4; d++) {
            const ni = this.play.puzzle.neighbour(cell, d);
            if (ni >= 0 && this.play.at(ni) === Mark.Unknown)
                return false;
        }
        return true;
    }
    #paintArrow(clue, cx, cy, s, colour) {
        const ctx = this.#ctx;
        const t = s * 0.11;
        const dx = clue.dir === Dir.Right ? 1 : clue.dir === Dir.Left ? -1 : 0;
        const dy = clue.dir === Dir.Down ? 1 : clue.dir === Dir.Up ? -1 : 0;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan2(dy, dx));
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.moveTo(t, 0);
        ctx.lineTo(-t * 0.7, t * 0.8);
        ctx.lineTo(-t * 0.7, -t * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    #paintMarginClue(clue, broken) {
        const ctx = this.#ctx;
        const p = this.#pitch;
        const row = clue.col < 0;
        const icon = MarginIcon * p;
        const reach = MarginGap * p + icon / 2;
        const cx = row ? this.#cardX - reach : this.#gridX + clue.col * p + p / 2;
        const cy = row ? this.#gridY + clue.row * p + p / 2 : this.#cardY - reach;
        const turns = clue.kind === ClueKind.Turns;
        const spent = !broken && this.#marginLanded(clue);
        const border = Math.max(1.25, icon * 0.05) * (broken ? 2.5 : 1);
        const face = spent ? Board.star : Board.marginFace;
        const edge = broken ? Chrome.brokenOnLight : Board.marginBorder;
        ctx.save();
        if (turns) {
            const r = icon / 2;
            ctx.fillStyle = face;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.clip();
            ctx.fillStyle = Slate.ink;
            ctx.fillRect(cx - r, cy + r * 0.45, 2 * r, r);
            ctx.restore();
            ctx.strokeStyle = edge;
            ctx.lineWidth = border;
            ctx.beginPath();
            ctx.arc(cx, cy, r - border / 2, 0, Math.PI * 2);
            ctx.stroke();
        }
        else {
            ctx.fillStyle = face;
            this.#roundRect(cx - icon / 2, cy - icon / 2, icon, icon, icon * 0.19);
            ctx.fill();
            ctx.strokeStyle = edge;
            ctx.lineWidth = border;
            const inset = border / 2;
            this.#roundRect(cx - icon / 2 + inset, cy - icon / 2 + inset, icon - border, icon - border, icon * 0.19 - inset / 2);
            ctx.stroke();
        }
        ctx.fillStyle = broken ? Chrome.brokenOnLight : Slate.ink;
        const digit = Math.max(icon * 0.42 / 0.78, Math.min(12, icon * 0.6));
        ctx.font = `600 ${Math.round(digit)}px ${Face}`;
        const lift = turns ? icon * (1 - 0.45) * 0.25 : 0;
        ctx.fillText(clueLabel(clue), cx, cy - lift + icon * 0.02);
        ctx.restore();
    }
    #marginLanded(clue) {
        const { rows, cols } = this.play;
        const horizontal = clue.col < 0;
        const length = horizontal ? cols : rows;
        let light = 0, runs = 1;
        let previous = Mark.Unknown;
        for (let i = 0; i < length; i++) {
            const m = this.play.at(horizontal ? clue.row * cols + i : i * cols + clue.col);
            if (m === Mark.Unknown)
                return false;
            if (m === Mark.Light)
                light++;
            if (i > 0 && m !== previous)
                runs++;
            previous = m;
        }
        return clue.kind === ClueKind.Turns ? runs === clue.value : light === clue.value;
    }
    #roundRect(x, y, w, h, r) {
        const ctx = this.#ctx;
        const rr = Math.max(0, Math.min(r, w / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
    }
}
_a = BoardView;

import { PlayBoard } from '../core/playBoard.js';
import { Mark, Tone } from '../core/types.js';
import * as W from '../content/walkthrough.js';
import { WalkSession } from '../content/walkLogic.js';
import { OffTarget, TryJudge, body as cardBody, cardFor, cardPuzzle, givenMarks, gestureFor } from '../content/lessons.js';
import * as State from '../content/teachState.js';
import { BoardView } from './board.js';
import { GhostHand } from './hand.js';
import { modeName } from './names.js';
import { Slate, brokenInk, inkOn } from './palette.js';
import { tonesFor } from './tone.js';
export const lessonDone = State.lessonDone;
export const ruleSeen = State.ruleSeen;
export function hasRuleCard(mechanic) { return cardFor(mechanic) !== null; }
const Css = `
.gt-walk, .gt-card {
  width: 100%; max-width: 30rem; margin: 0 auto; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; gap: .55rem;
  padding: .5rem 1rem 1.25rem; text-align: center; color: var(--ink, #2A1A5E);
}
.gt-dots { display: flex; gap: .55rem; align-items: center; justify-content: center; height: 1rem; margin: 0; padding: 0; }
.gt-dot { width: .5rem; height: .5rem; border-radius: 50%; background: rgba(101, 94, 124, .6); transition: width .2s, height .2s, background-color .2s; }
.gt-dot.on { background: #FFC23D; }
.gt-dot.here { width: .8rem; height: .8rem; background: #FFC23D; }
.gt-head { display: flex; align-items: center; justify-content: center; gap: .5rem; }
.gt-title { font-size: 1.3rem; font-weight: 800; margin: 0; line-height: 1.2; }
.gt-caption { margin: 0; min-height: 2.8em; font-size: 1rem; line-height: 1.38; }
.gt-caption span { display: block; }
.gt-caption span + span { font-weight: 800; }
.gt-ask { margin: 0; font-weight: 800; font-size: 1.05rem; line-height: 1.35; }
.gt-body { margin: 0; color: var(--muted, #655E7C); font-size: .92rem; line-height: 1.42; max-width: 26rem; }
.gt-nudge { margin: 0; min-height: 2.7em; color: var(--muted, #655E7C); font-size: .95rem; line-height: 1.38; }
.gt-stage { position: relative; width: 100%; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.gt-walk .gt-stage { padding-top: 2.7rem; }
.gt-board { display: flex; justify-content: center; width: 100%; }
.gt-layer { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.gt-callout {
  position: absolute; white-space: nowrap; font-size: .8rem; font-weight: 800; line-height: 1.2;
  padding: .22rem .6rem; border-radius: .6rem; background: #FFFFFF; color: #1B1D22;
  box-shadow: 0 0 0 1.5px rgba(27, 29, 34, .18), 0 2px 6px rgba(42, 26, 94, .12);
}
.gt-stem { position: absolute; width: 3px; margin-left: -1.5px; background: #F0F1EC; box-shadow: 0 0 0 1px rgba(27, 29, 34, .35); border-radius: 2px; }
.gt-ring { position: absolute; border-radius: 999px; border: 3px solid #FFC23D; box-sizing: border-box; transform: translate(-50%, -50%); animation: gt-breathe 1.9s ease-in-out infinite; }
@keyframes gt-breathe { 0%, 100% { transform: translate(-50%, -50%) scale(1); } 50% { transform: translate(-50%, -50%) scale(1.14); } }
.gt-ring.gt-slipring { z-index: 2; }
.gt-tick { position: absolute; width: 2rem; height: 2rem; border-radius: 50%; background: #4C9A6A; color: #FFFFFF; display: grid; place-items: center; font-weight: 800; font-size: 1.05rem; transform: translate(-50%, -50%); box-shadow: 0 2px 6px rgba(0, 0, 0, .2); }
.gt-foot { min-height: 3.4rem; display: flex; align-items: center; justify-content: center; gap: .75rem; flex-wrap: wrap; }
.gt-link {
  background: none; box-shadow: none; color: var(--muted, #655E7C); font-weight: 600; font-size: .9rem;
  text-decoration: underline; text-underline-offset: .18em; padding: .4rem .6rem; min-height: 2.75rem;
}
.gt-link:active:not(:disabled) { transform: none; box-shadow: none; }
.gt-info {
  width: 2rem; height: 2rem; min-height: 2rem; padding: 0; border-radius: 50%; flex: none;
  font-family: Georgia, "Times New Roman", serif; font-style: italic; font-weight: 700; font-size: 1.05rem;
  box-shadow: 0 3px 0 var(--lip, #D4C4A4);
}
.gt-info[aria-expanded="true"] { background: var(--accent, #FFC23D); color: var(--on-accent, #3A2300); }
@media (prefers-reduced-motion: reduce) { .gt-ring { animation: none; } .gt-dot { transition: none; } }
`;
function injectStyles() {
    if (document.getElementById('gt-teach-css') !== null)
        return;
    const s = document.createElement('style');
    s.id = 'gt-teach-css';
    s.textContent = Css;
    document.head.appendChild(s);
}
function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls !== undefined)
        e.className = cls;
    if (text !== undefined)
        e.textContent = text;
    return e;
}
function button(cls, text) {
    const b = el('button', cls, text);
    b.type = 'button';
    return b;
}
function setLines(p, text) {
    const glued = W.glue(text);
    if (p.dataset.text === glued)
        return;
    p.dataset.text = glued;
    p.replaceChildren(...glued.split('\n').map((row) => el('span', undefined, row)));
}
function reducedMotion() {
    try {
        return matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    catch {
        return false;
    }
}
const clock = () => performance.now() / 1000;
function badgeAt(rect, layer) {
    const s = rect.width;
    return {
        x: rect.left + s / 2 - 0.36 * s - layer.left,
        y: rect.top + s / 2 - 0.31 * s - layer.top,
        d: s * (76 / 190) / 0.94,
    };
}
function ringStyle(e, x, y, w, h) {
    e.style.left = `${x}px`;
    e.style.top = `${y}px`;
    e.style.width = `${w}px`;
    e.style.height = `${h}px`;
}
export function runWalkthrough(host, options) {
    injectStyles();
    const replay = options.replay === true;
    const root = el('section', 'gt-walk');
    root.setAttribute('aria-label', 'How to play');
    const dots = el('div', 'gt-dots');
    dots.setAttribute('aria-hidden', 'true');
    const dotEls = Array.from({ length: W.Count }, () => el('span', 'gt-dot'));
    dots.append(...dotEls);
    const title = el('h2', 'gt-title');
    const caption = el('p', 'gt-caption');
    caption.setAttribute('aria-live', 'polite');
    const stage = el('div', 'gt-stage');
    const boardWrap = el('div', 'gt-board');
    const canvas = el('canvas');
    canvas.setAttribute('aria-label', 'Lesson board');
    boardWrap.appendChild(canvas);
    const layer = el('div', 'gt-layer');
    stage.append(boardWrap, layer);
    const foot = el('div', 'gt-foot');
    const go = button('primary', '');
    go.hidden = true;
    foot.appendChild(go);
    const skip = button('gt-link', replay ? 'Close' : 'I know how to play');
    root.append(dots, title, caption, stage, foot, skip);
    host.appendChild(root);
    const numberRing = el('div', 'gt-ring gt-slipring');
    numberRing.hidden = true;
    const tick = el('div', 'gt-tick', '✓');
    tick.hidden = true;
    layer.append(numberRing, tick);
    let calloutEls = [];
    const s = new WalkSession({ replay });
    s.go(0);
    const view = new BoardView(canvas, s.board, {
        onMark: (cell, _tone, committed, d) => s.mark(cell, committed, d.gesture, d.refused, clock()),
    });
    view.setTapTone(Mark.Shadow);
    const hand = new GhostHand(layer);
    let disposed = false;
    let raf = 0;
    let shownScene = -1;
    let gliding = false;
    let ringKey = '';
    s.onHand = (req) => {
        if (gliding || view.play !== s.board) {
            s.handFinished(clock());
            return;
        }
        void hand.play(view.cellRect(req.cell), req.hold).then(() => s.handFinished(clock()));
    };
    s.onHandStop = () => hand.stop();
    s.onChange = () => render();
    function enterScene() {
        const first = shownScene < 0;
        shownScene = s.scene;
        hand.stop();
        clearOverlays();
        const land = () => {
            if (disposed)
                return;
            view.load(s.board);
            view.setTapTone(Mark.Shadow);
            ringKey = '';
            gliding = false;
            s.arrived(clock());
            render();
        };
        const half = W.PanTime * 1000 / 2;
        if (first || reducedMotion() || typeof boardWrap.animate !== 'function') {
            land();
            return;
        }
        gliding = true;
        const out = boardWrap.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-28%)', opacity: 0 }], { duration: half, easing: 'ease-in', fill: 'forwards' });
        out.onfinish = () => {
            land();
            const back = boardWrap.animate([{ transform: 'translateX(28%)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: half, easing: 'cubic-bezier(.2,.7,.3,1)' });
            back.onfinish = () => { out.cancel(); place(); };
            out.cancel();
            boardWrap.style.transform = '';
        };
    }
    function clearOverlays() {
        numberRing.hidden = true;
        tick.hidden = true;
        for (const c of calloutEls)
            c.remove();
        calloutEls = [];
    }
    function place() {
        if (disposed || gliding || view.play !== s.board)
            return;
        const L = layer.getBoundingClientRect();
        const scene = s.current;
        const lines = s.phase === 'arriving' ? [] : s.calloutLines();
        if (calloutEls.length !== scene.callouts.length * 3 || lines.length === 0) {
            for (const c of calloutEls)
                c.remove();
            calloutEls = [];
            if (lines.length > 0)
                for (const _ of scene.callouts) {
                    const label = el('div', 'gt-callout'), stem = el('div', 'gt-stem'), ring = el('div', 'gt-ring');
                    layer.append(stem, ring, label);
                    calloutEls.push(label, stem, ring);
                }
        }
        const canvasTop = canvas.getBoundingClientRect().top - L.top;
        let prevRight = -Infinity;
        scene.callouts.forEach((c, k) => {
            const label = calloutEls[k * 3], stem = calloutEls[k * 3 + 1], ring = calloutEls[k * 3 + 2];
            const rect = view.cellRect(c.cell);
            if (label === undefined || rect === null)
                return;
            label.textContent = lines[k];
            const corner = c.at === 'corner';
            const b = badgeAt(rect, L);
            const tx = corner ? b.x : rect.left + rect.width / 2 - L.left;
            const ty = corner ? b.y - b.d / 2 : rect.top + rect.height * 0.22 - L.top;
            const lw = label.offsetWidth, lh = label.offsetHeight;
            const bottom = canvasTop - 6;
            let lx = corner ? tx + 14 - lw : tx - 14;
            lx = Math.max(0, prevRight + 6, Math.min(L.width - lw, lx));
            prevRight = lx + lw;
            label.style.left = `${lx}px`;
            label.style.top = `${bottom - lh}px`;
            stem.style.left = `${tx}px`;
            stem.style.top = `${bottom}px`;
            stem.style.height = `${Math.max(6, ty - bottom)}px`;
            ring.hidden = !corner;
            if (corner)
                ringStyle(ring, b.x, b.y, b.d, b.d);
        });
        const nr = s.numberRing >= 0 ? view.cellRect(s.numberRing) : null;
        numberRing.hidden = nr === null;
        if (nr !== null) {
            const b = badgeAt(nr, L);
            ringStyle(numberRing, b.x, b.y, b.d, b.d);
            numberRing.style.borderColor = brokenInk(s.board.at(s.numberRing) === Mark.Light);
        }
        const cr = canvas.getBoundingClientRect();
        tick.hidden = !(s.sceneDone && s.celebrate);
        tick.style.left = `${cr.right - L.left - 6}px`;
        tick.style.top = `${cr.top - L.top + 6}px`;
    }
    function render() {
        if (disposed)
            return;
        if (s.scene !== shownScene) {
            enterScene();
            return;
        }
        title.textContent = s.title;
        setLines(caption, s.caption);
        dotEls.forEach((d, i) => {
            d.classList.toggle('here', i === s.scene);
            d.classList.toggle('on', i < s.scene || s.seen[i]);
        });
        const label = s.buttonLabel;
        go.hidden = label === null;
        if (label !== null && go.textContent !== label)
            go.textContent = label;
        skip.hidden = label !== null;
        if (gliding || view.play !== s.board)
            return;
        view.readOnly = s.readOnly;
        view.unlockAll();
        for (const c of s.rightCells())
            view.lockCell(c, true);
        const rings = new Map();
        if (s.flashCell >= 0)
            rings.set(s.flashCell, 'focus');
        if (s.ring !== null)
            rings.set(s.ring.cell, s.ring.style);
        const key = [...rings].map(([c, st]) => `${c}:${st}`).join(',');
        if (key !== ringKey) {
            ringKey = key;
            view.clearRings();
            for (const [c, st] of rings)
                view.ring(c, st);
        }
        place();
    }
    function frame() {
        if (disposed)
            return;
        s.tick(clock());
        raf = requestAnimationFrame(frame);
    }
    const onResize = () => { view.resize(); place(); };
    addEventListener('resize', onResize);
    function end(then) {
        State.markLessonDone();
        dispose();
        then();
    }
    go.addEventListener('click', () => { if (s.buttonLabel !== null)
        end(options.onDone); });
    skip.addEventListener('click', () => end(options.onSkip));
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        cancelAnimationFrame(raf);
        removeEventListener('resize', onResize);
        hand.dispose();
        root.remove();
    }
    view.resize();
    render();
    raf = requestAnimationFrame(frame);
    return { dispose };
}
const ToneNames = new Map([[Mark.Shadow, 'Dark'], [Mark.Light, 'Light'], [Mark.Gold, 'Gold']]);
const ToneFills = new Map([[Mark.Shadow, Slate.ink], [Mark.Light, Slate.lit], [Mark.Gold, Slate.accent]]);
function markOf(t) { return t === Tone.Shadow ? Mark.Shadow : t === Tone.Light ? Mark.Light : Mark.Gold; }
export function showRuleCard(host, mechanic, options) {
    const card = cardFor(mechanic);
    if (card === null)
        return null;
    injectStyles();
    State.markRuleSeen(mechanic);
    const root = el('section', 'gt-card');
    root.setAttribute('aria-label', modeName(mechanic) ?? 'A rule');
    const head = el('div', 'gt-head');
    const title = el('h2', 'gt-title', card.title);
    const info = button('gt-info', 'i');
    info.setAttribute('aria-label', 'More about this rule');
    info.setAttribute('aria-expanded', 'false');
    head.append(title, info);
    const more = el('p', 'gt-body', cardBody(card));
    more.hidden = true;
    const ask = el('p', 'gt-ask', card.ask);
    const stage = el('div', 'gt-stage');
    const boardWrap = el('div', 'gt-board');
    const canvas = el('canvas');
    canvas.setAttribute('aria-label', 'Rule board');
    boardWrap.appendChild(canvas);
    const layer = el('div', 'gt-layer');
    stage.append(boardWrap, layer);
    const nudge = el('p', 'gt-nudge');
    nudge.setAttribute('aria-live', 'polite');
    const foot = el('div', 'gt-foot');
    const play = button('primary', 'Play');
    play.hidden = true;
    const goldBoard = tonesFor(mechanic).includes(Mark.Gold);
    const tone = goldBoard ? button('tone', '') : null;
    if (tone !== null)
        foot.appendChild(tone);
    foot.appendChild(play);
    const links = el('div', 'gt-foot');
    const skip = button('gt-link', 'Skip');
    links.appendChild(skip);
    const how = options.onHowToPlay !== undefined ? button('gt-link', 'How to play') : null;
    if (how !== null)
        links.appendChild(how);
    root.append(head, more, ask, stage, nudge, foot, links);
    host.appendChild(root);
    const puzzle = cardPuzzle(card);
    const board = new PlayBoard(puzzle);
    const given = givenMarks(card);
    for (let i = 0; i < given.length; i++)
        if (given[i] !== Mark.Unknown && !board.isLocked(i))
            board.put(i, given[i]);
    const judge = new TryJudge(card);
    const answer = markOf(card.answer);
    const gesture = gestureFor(card.answer);
    let disposed = false;
    let lastMoveAt = clock();
    let nudgedAt = -1000;
    let handBusy = false;
    let raf = 0;
    const view = new BoardView(canvas, board, {
        counts: false,
        onMark: (cell, _t, committed) => {
            if (!committed || judge.settled)
                return;
            lastMoveAt = clock();
            hand.stop();
            const v = judge.judge(cell, board.at(cell));
            if (v.kind === 'solved')
                settle(v.byPlayer);
            else if (v.kind === 'nudge')
                nudge.textContent = card.nudge;
            else if (v.kind === 'offTarget')
                nudge.textContent = OffTarget;
        },
    });
    view.setTapTone(Mark.Shadow);
    for (let i = 0; i < given.length; i++)
        if (given[i] !== Mark.Unknown)
            view.lockCell(i, true);
    const hand = new GhostHand(layer);
    function paintTone() {
        if (tone === null)
            return;
        const now = view.firstTone;
        const fill = ToneFills.get(now);
        tone.innerHTML = `<span class="swatch" style="background:${fill};color:${inkOn(fill)}">${ToneNames.get(now)}</span>`;
        tone.setAttribute('aria-label', `Tap paints ${ToneNames.get(now)}. Press to change.`);
    }
    if (tone !== null) {
        tone.addEventListener('click', () => {
            const ring = tonesFor(mechanic);
            view.setTapTone(ring[(ring.indexOf(view.firstTone) + 1) % ring.length]);
            paintTone();
        });
        paintTone();
    }
    info.addEventListener('click', () => {
        more.hidden = !more.hidden;
        info.setAttribute('aria-expanded', String(!more.hidden));
    });
    async function showHand() {
        handBusy = true;
        view.ring(card.target, 'target');
        if (gesture === 'gold' && tone !== null && view.firstTone !== Mark.Gold) {
            const moveStamp = lastMoveAt;
            await hand.play(tone.getBoundingClientRect(), false);
            if (disposed || judge.settled || lastMoveAt !== moveStamp) {
                handBusy = false;
                nudgedAt = clock();
                return;
            }
        }
        await hand.play(view.cellRect(card.target), gesture === 'hold');
        handBusy = false;
        nudgedAt = clock();
    }
    function frame() {
        if (disposed)
            return;
        const now = clock();
        if (!judge.settled && !handBusy && now - lastMoveAt >= W.IdleWait && now - nudgedAt >= W.NudgeEvery)
            void showHand();
        raf = requestAnimationFrame(frame);
    }
    function settle(_byPlayer) {
        hand.stop();
        const sol = card.solution;
        for (let i = 0; i < sol.length; i++) {
            if (board.isLocked(i) || puzzle.isVoid(i))
                continue;
            const want = sol[i] === '#' ? Mark.Shadow : sol[i] === '.' ? Mark.Light : Mark.Gold;
            if (board.at(i) !== want)
                board.put(i, want);
        }
        view.readOnly = true;
        view.clearRings();
        view.paint();
        nudge.textContent = '';
        if (tone !== null)
            tone.hidden = true;
        skip.hidden = true;
        play.hidden = false;
        try {
            play.focus({ preventScroll: true });
        }
        catch { }
    }
    const onResize = () => view.resize();
    addEventListener('resize', onResize);
    function dispose() {
        if (disposed)
            return;
        disposed = true;
        cancelAnimationFrame(raf);
        removeEventListener('resize', onResize);
        hand.dispose();
        root.remove();
    }
    const close = (then) => { dispose(); then(); };
    play.addEventListener('click', () => close(options.onClose));
    skip.addEventListener('click', () => close(options.onClose));
    how?.addEventListener('click', () => close(options.onHowToPlay));
    view.resize();
    raf = requestAnimationFrame(frame);
    return { dispose };
}
export function firstVisit(host, mechanic, onReady) {
    const needWalk = !State.lessonDone();
    const needCard = hasRuleCard(mechanic) && !State.ruleSeen(mechanic);
    if (!needWalk && !needCard)
        return null;
    let current = null;
    const toCard = () => {
        current = showRuleCard(host, mechanic, { onClose: onReady });
        if (current === null)
            onReady();
    };
    if (needWalk)
        current = runWalkthrough(host, { onDone: () => (needCard ? toCard() : onReady()), onSkip: onReady });
    else
        toCard();
    return { dispose: () => current?.dispose() };
}
export function showHelp(host, mechanic, onClose) {
    let current = null;
    const walk = () => { current = runWalkthrough(host, { onDone: onClose, onSkip: onClose, replay: State.lessonDone() }); };
    current = showRuleCard(host, mechanic, { onClose, onHowToPlay: walk });
    if (current === null)
        walk();
    return { dispose: () => current?.dispose() };
}

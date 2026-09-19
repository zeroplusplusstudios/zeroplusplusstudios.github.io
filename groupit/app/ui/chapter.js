// The public sample chapter: First Light, all 154 boards, playable in one page.
//
// **Why a whole chapter and not another single board.** The landing page deals one board, which
// answers "what is this" and nothing else. A visitor who liked that board has no way to find out
// whether they would like the GAME — whether the boards grow, whether the ideas keep arriving —
// and that, not the first tap, is the question an install actually turns on. So the chapter the
// app itself opens with is the chapter that is public: it is free in the app (UnlockStars = 0),
// it carries no mechanic, and it is authored as a ramp rather than as a sampler.
//
// It plays the chapter the way the app's chapter screen does — six named parts, each with the
// one idea behind it — because that structure is the content, not decoration: a stretch of
// boards exists BECAUSE there is a technique it wants you to find.
//
// WHAT THIS PAGE DOES NOT DO. It does not know the rules and it does not hold the answers. Every
// board arrives as a share payload with the solution stripped (see chapterOne.ts), is decoded by
// the same `fromLink` a shared link goes through, and is judged solved by `PlayBoard`. There is
// no fourth path through the rules on this site and there is not going to be one.
import { fromLink, Head, HeadBase, link as makeLink } from '../core/shareCodec.js';
import { PlayBoard } from '../core/playBoard.js';
import { praise, rate, requirement } from '../core/scoring.js';
import { BoardView } from './board.js';
import { bindToneToggle } from './tone.js';
import { Boards, Parts, Tagline, Teaches, Title } from './chapterOne.js';
const $ = (id) => document.getElementById(id);
// ─────────────────────────────────────────────────────────────────────── progress
//
// One character per board — '.' for untouched, '0'–'3' for the best star count so far. A string
// rather than JSON because it is 154 bytes, it cannot half-parse, and a re-bake that changes the
// board count is survivable by padding rather than by a migration.
const KEY = 'groupit.web.c1';
function readStars() {
    let raw = '';
    // localStorage throws outright in some contexts — a private window, a thumbnailer, a browser
    // set to block site data — and a chapter that will not open because progress could not be read
    // is a far worse failure than progress that does not stick. Same call tone.ts makes.
    try {
        raw = localStorage.getItem(KEY) ?? '';
    }
    catch { /* no storage; nothing is remembered */ }
    const out = [];
    for (let i = 0; i < Boards.length; i++) {
        const c = raw[i];
        out.push(c === '0' || c === '1' || c === '2' || c === '3' ? c : '.');
    }
    return out;
}
const stars = readStars();
function record(at, got) {
    const had = stars[at] === '.' ? -1 : Number(stars[at]);
    if (got <= had)
        return; // never demote: a replay for fun is not a regression
    stars[at] = String(got);
    try {
        localStorage.setItem(KEY, stars.join(''));
    }
    catch { /* see readStars */ }
    paintProgress();
    paintTile(at);
}
function solvedCount() {
    let n = 0;
    for (const s of stars)
        if (s !== '.')
            n++;
    return n;
}
function paintProgress() {
    const done = solvedCount();
    $('progress').textContent = `${done} / ${Boards.length} solved`;
    // Only on the picker. A win calls this, and three chips is one more than a 375px header holds
    // without wrapping onto a second row while the player is looking at the board.
    $('progress').hidden = done === 0 || current >= 0;
}
// ────────────────────────────────────────────────────────────────────── the picker
const tiles = [];
function paintTile(at) {
    const tile = tiles[at];
    if (tile === undefined)
        return;
    const got = stars[at];
    const board = Boards[at];
    tile.className = got === '.' ? 'tile' : 'tile done';
    tile.innerHTML =
        `<span class="n">${at + 1}</span>` +
            `<span class="s">${got === '.' ? `${board.rows}×${board.cols}` : '★'.repeat(Number(got)) || 'solved'}</span>`;
    tile.setAttribute('aria-label', got === '.'
        ? `Board ${at + 1}, ${board.rows} by ${board.cols}, not yet solved`
        : `Board ${at + 1}, solved with ${got} of 3 stars`);
}
function buildPicker() {
    const into = $('parts');
    for (const part of Parts) {
        const section = document.createElement('section');
        section.className = 'part';
        const head = document.createElement('div');
        head.className = 'parthead';
        head.innerHTML =
            `<h2>${part.title}</h2>` +
                `<span class="chip">${part.from + 1}–${part.from + part.count}</span>`;
        const teaches = document.createElement('p');
        teaches.className = 'teaches';
        teaches.textContent = part.teaches;
        // Part one restates the chapter's own line, which is right in the app — the two are read on
        // different screens there — and is the same sentence twice within a thumb's length here.
        teaches.hidden = part.teaches === Teaches;
        const grid = document.createElement('div');
        grid.className = 'tiles';
        for (let i = part.from; i < part.from + part.count; i++) {
            const tile = document.createElement('button');
            tile.type = 'button';
            // The hash IS the route: a tile sets it, `hashchange` renders it, and the browser's own
            // back button then works without this page owning a history stack.
            tile.addEventListener('click', () => { location.hash = String(i + 1); });
            tiles[i] = tile;
            grid.appendChild(tile);
            paintTile(i);
        }
        section.append(head, teaches, grid);
        into.appendChild(section);
    }
}
// ──────────────────────────────────────────────────────────────────────── playing
let view = null;
let current = -1;
let won = false;
let withdrew = false;
function refresh() {
    if (view === null)
        return;
    const play = view.play;
    const status = play.status;
    const left = play.puzzle.playableCells - status.committed;
    $('left').textContent = left === 0 ? 'every cell filled' : `${left} to go`;
    const broken = status.brokenClueCount + status.brokenLawCount;
    const warn = $('warn');
    warn.hidden = broken === 0;
    if (broken > 0)
        warn.textContent = broken === 1 ? 'Something here cannot work' : `${broken} things here cannot work`;
    $('undo').disabled = !play.canUndo;
    if (status.solved && !won) {
        won = true;
        const got = rate(true, play.everWrong, withdrew);
        record(current, got);
        $('winStars').textContent = '★'.repeat(got) + '☆'.repeat(3 - got);
        $('winTitle').textContent = praise(got);
        $('winNote').textContent = got === 3 ? 'Nothing to improve on that one.' : requirement(got + 1);
        const last = current === Boards.length - 1;
        const next = $('next');
        next.hidden = last;
        next.textContent = `Board ${current + 2}`;
        $('finished').hidden = !last;
        $('win').hidden = false;
        // The board fills a phone screen, so the card lands below the fold and a player who just
        // finished sees nothing happen.
        const motion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        $('win').scrollIntoView({ behavior: motion ? 'auto' : 'smooth', block: 'center' });
    }
}
async function open(at) {
    const board = Boards[at];
    if (board === undefined) {
        showPicker();
        return;
    }
    current = at;
    won = false;
    withdrew = false;
    $('picker').hidden = true;
    $('win').hidden = true;
    $('play').hidden = false;
    $('which').textContent = `Board ${at + 1} / ${Boards.length}`;
    $('shape').textContent = `${board.rows} × ${board.cols}`;
    $('which').hidden = false;
    $('shape').hidden = false;
    $('progress').hidden = true;
    $('partOf').textContent = Parts.find(p => at >= p.from && at < p.from + p.count)?.title ?? Title;
    let puzzle;
    try {
        puzzle = await fromLink(Head + board.b);
    }
    catch (e) {
        // Only reachable if the baked payload is corrupt, which test/chapter.ts decodes every one of
        // to rule out — so say what happened rather than pretending the board is merely busy.
        $('play').hidden = true;
        $('picker').hidden = false;
        $('broken').textContent = `Board ${at + 1} would not open (${e.message}).`;
        $('broken').hidden = false;
        return;
    }
    const play = new PlayBoard(puzzle);
    if (view === null) {
        view = new BoardView($('canvas'), play, { onChange: refresh });
        bindToneToggle($('tone'), view);
    }
    else {
        view.load(play);
    }
    view.resize();
    refresh();
    scrollTo({ top: 0, behavior: 'auto' });
}
function showPicker() {
    current = -1;
    $('play').hidden = true;
    $('win').hidden = true;
    $('picker').hidden = false;
    $('which').hidden = true;
    $('shape').hidden = true;
    paintProgress();
}
/** The board named by the hash, 1-based, or -1 for the picker. */
function routed() {
    const raw = location.hash.replace(/^#/, '');
    if (!/^\d+$/.test(raw))
        return -1;
    const n = Number(raw) - 1;
    return n >= 0 && n < Boards.length ? n : -1;
}
function route() {
    const at = routed();
    if (at < 0)
        showPicker();
    else
        void open(at);
}
// ─────────────────────────────────────────────────────────────────────────── wiring
buildPicker();
paintProgress();
$('undo').addEventListener('click', () => { withdrew = true; view?.undo(); });
$('reset').addEventListener('click', () => {
    withdrew = true;
    won = false;
    $('win').hidden = true;
    view?.reset();
});
$('back').addEventListener('click', () => { location.hash = ''; });
$('next').addEventListener('click', () => { location.hash = String(current + 2); });
$('backToList').addEventListener('click', () => { location.hash = ''; });
$('share').addEventListener('click', async () => {
    if (view === null)
        return;
    const mine = await makeLink(view.play.puzzle);
    // Relative to THIS page, not an absolute /groupit/ path: the site is served from the repo root
    // under a preview server and from /groupit/ on Pages, and a hardcoded prefix is wrong in one of
    // those two places. The shared board lands on the ordinary share page, which is the page a
    // stranger receiving it should get — not this chapter.
    const share = new URL('../b/', location.href).href + '#' + mine.slice(HeadBase.length);
    const text = 'Try this GroupIt board: ' + share;
    if (navigator.share !== undefined) {
        try {
            await navigator.share({ text });
            return;
        }
        catch { /* dismissed; fall through */ }
    }
    try {
        await navigator.clipboard.writeText(text);
        const b = $('share');
        const was = b.textContent;
        b.textContent = 'Link copied';
        setTimeout(() => { b.textContent = was; }, 1600);
    }
    catch {
        prompt('Copy this link:', text);
    }
});
$('chapterTitle').textContent = Title;
$('chapterTagline').textContent = Tagline;
$('chapterTeaches').textContent = Teaches;
addEventListener('resize', () => { if (!$('play').hidden)
    view?.resize(); });
addEventListener('hashchange', route);
route();
//# sourceMappingURL=chapter.js.map
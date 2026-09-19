// The shared-board page: decode the link, deal the board, play it.
//
// This is the page the whole website exists for. Someone was sent a link by a friend; they may
// have no idea what GroupIt is, they are probably on a phone, and they have not installed
// anything. Everything here is in service of getting them to a playable board in one screen.
import { fromLink, looksLikeLink, link as makeLink, Head, HeadBase } from '../core/shareCodec.js';
import { PlayBoard } from '../core/playBoard.js';
import { praise, rate, requirement } from '../core/scoring.js';
import { Mechanic } from '../core/mechanic.js';
import { BoardView } from './board.js';
import { bindToneToggle } from './tone.js';
const $ = (id) => document.getElementById(id);
/**
 * The link for this page.
 *
 * A board arrives as `/groupit/b/#1<payload>` — the version digit and the payload in the
 * FRAGMENT, which is exactly the tail the canonical link carries after `b/#`, so this rebuilds
 * the link by putting `HeadBase` back in front of it rather than by parsing anything. Two reasons
 * the payload is a fragment rather than a path. Pages would 404 a path segment there, since there
 * is no file at that name and no rewrite rule to invent one. And a fragment is never sent to the
 * server, so the board somebody is playing is not in anybody's access log.
 *
 * The version digit stays IN the fragment rather than being implied by the page, so a future
 * format bump is visible in the URL and an old page can say "this board needs a newer version"
 * instead of decoding it wrongly.
 *
 * `?b=` is accepted too: a query string survives some clients' link rewriting that a fragment
 * does not.
 *
 * Note what this does NOT do: strip a leading `1` from the payload. An earlier draft did, on the
 * muddled theory that the digit was duplicated — and base64url payloads legitimately begin with
 * `1`, so that quietly corrupted roughly one board in sixty-four into an unopenable link.
 */
function linkFromLocation() {
    const frag = location.hash.replace(/^#/, '');
    if (frag.length > 0)
        return HeadBase + frag;
    const q = new URLSearchParams(location.search).get('b');
    if (q !== null && q.length > 0)
        return HeadBase + q;
    return null;
}
function show(which) {
    for (const id of ['loading', 'board', 'error'])
        $(id).hidden = id !== which;
}
function fail(message, detail) {
    $('errorTitle').textContent = message;
    $('errorBody').textContent = detail;
    show('error');
}
function ruleName(m) {
    if (m === Mechanic.None)
        return null;
    // Mechanic names are PascalCase identifiers; the board's own chapter titles live in content
    // the site does not ship, so a spaced-out enum name is the honest fallback rather than a
    // guess at the prose the app would print.
    return Mechanic[m].replace(/([a-z])([A-Z])/g, '$1 $2');
}
async function main() {
    const url = linkFromLocation();
    if (url === null || !looksLikeLink(url)) {
        fail('No board in this link', 'A GroupIt board link looks like ' + Head + '… — check the whole link was copied, ' +
            'including everything after the last slash.');
        return;
    }
    let puzzle;
    try {
        puzzle = await fromLink(url);
    }
    catch (e) {
        fail('This link is not a board', 'It may have been cut short when it was sent, or it may be from a newer version of the ' +
            'game than this page understands. (' + e.message + ')');
        return;
    }
    const play = new PlayBoard(puzzle);
    const canvas = $('canvas');
    const view = new BoardView(canvas, play, { onChange: refresh });
    $('size').textContent = `${puzzle.rows} × ${puzzle.cols}`;
    const rule = ruleName(puzzle.mechanic);
    const ruleChip = $('rule');
    ruleChip.hidden = rule === null;
    if (rule !== null)
        ruleChip.textContent = rule;
    show('board');
    bindToneToggle($('tone'), view);
    view.resize();
    let won = false;
    function refresh() {
        const status = play.status;
        const left = puzzle.playableCells - status.committed;
        $('left').textContent = left === 0 ? 'every cell filled' : `${left} to go`;
        const broken = status.brokenClueCount + status.brokenLawCount;
        const warn = $('warn');
        warn.hidden = broken === 0;
        if (broken > 0)
            warn.textContent = broken === 1 ? 'Something here cannot work' : `${broken} things here cannot work`;
        $('undo').disabled = !play.canUndo;
        if (status.solved && !won) {
            won = true;
            // everWithdrew: the third star is the no-undo, no-reset one, and this page counts a reset
            // the same way the app does.
            const stars = rate(true, play.everWrong, withdrew);
            $('winTitle').textContent = praise(stars);
            $('winStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
            $('winNote').textContent = stars === 3
                ? 'Nothing to improve on that one.'
                : requirement(stars + 1);
            $('win').hidden = false;
            // The board fills a phone screen, so the card lands below the fold and a player who just
            // finished sees nothing happen. Scroll it up — honouring reduced-motion, because a jump
            // the size of a screen is exactly what that setting is about.
            const motion = matchMedia('(prefers-reduced-motion: reduce)').matches;
            $('win').scrollIntoView({ behavior: motion ? 'auto' : 'smooth', block: 'center' });
        }
    }
    let withdrew = false;
    $('undo').addEventListener('click', () => { withdrew = true; view.undo(); });
    $('reset').addEventListener('click', () => {
        withdrew = true;
        $('win').hidden = true;
        won = false;
        view.reset();
    });
    $('share').addEventListener('click', async () => {
        const mine = await makeLink(puzzle);
        const share = location.origin + location.pathname + '#' + mine.slice(HeadBase.length);
        const text = 'Try this GroupIt board: ' + share;
        // The Web Share sheet where there is one (every phone), the clipboard everywhere else —
        // the same two-step fallback ShareOut.cs makes on the app side.
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
    addEventListener('resize', () => view.resize());
    addEventListener('hashchange', () => location.reload());
    refresh();
}
main().catch((e) => {
    fail('Something went wrong', String(e?.message ?? e));
});
//# sourceMappingURL=play.js.map
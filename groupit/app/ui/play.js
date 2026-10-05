// The shared-board page: decode the link, deal the board, play it.
//
// This is the page the whole website exists for. Someone was sent a link by a friend; they may
// have no idea what GroupIt is, they are probably on a phone, and they have not installed
// anything. Everything here is in service of getting them to a playable board in one screen.
import { fromLink, classifyLink, normaliseLink, link as makeLink, Head, HeadBase } from '../core/shareCodec.js';
import { PlayBoard } from '../core/playBoard.js';
import { isPerfect } from '../core/scoring.js';
import { BoardView } from './board.js';
import { bindToneToggle } from './tone.js';
import { boardLine, modeName, sizeText } from './names.js';
import { decodeWhy, explain, isShareDismissed, troubleOf } from './errors.js';
import { ruleValue, solveBucket, start, track } from './analytics.js';
const $ = (id) => document.getElementById(id);
/**
 * The text this page was opened with, from which its board link is taken.
 *
 * A board arrives as `/groupit/b/#1<payload>` — the version digit and the payload in the
 * FRAGMENT. Two reasons the payload is a fragment rather than a path. Pages would 404 a path
 * segment there, since there is no file at that name and no rewrite rule to invent one. And a
 * fragment is never sent to the server, so the board somebody is playing is not in anybody's
 * access log.
 *
 * The version digit stays IN the fragment rather than being implied by the page, so a future
 * format bump is visible in the URL and an old page can say "this board needs a newer version"
 * instead of decoding it wrongly — which `classifyLink` now does (2026-10-05): a link of a
 * version this page does not read used to get "No board in this link, check the whole link was
 * copied", the wrong diagnosis for a link that was copied perfectly.
 *
 * The whole address is handed over, not just the hash, and `normaliseLink` finds the board in it:
 * the same function the app uses (its C# twin is `ShareCodec.Normalise`), so the page and the app
 * agree on what a link is.
 *
 * `?b=` is accepted too: a query string survives some clients' link rewriting that a fragment
 * does not. It carries the version and payload exactly as the fragment would.
 *
 * Note what this does NOT do: strip a leading `1` from the payload. An earlier draft did, on the
 * muddled theory that the digit was duplicated — and base64url payloads legitimately begin with
 * `1`, so that quietly corrupted roughly one board in sixty-four into an unopenable link.
 */
function textFromLocation() {
    if (location.hash.replace(/^#/, '').length > 0)
        return location.href;
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
    // No board, so no size: the chip would otherwise sit in the header as a lone dash.
    $('size').hidden = true;
    $('errorTitle').textContent = message;
    $('errorBody').textContent = detail;
    show('error');
}
function failWith(kind, e) {
    // The engine's reason goes to the console, not onto the card (src/ui/errors.ts).
    const why = explain(kind, e);
    fail(why.title, why.body);
}
async function main() {
    // Web analytics (src/ui/analytics.ts). Dark unless a measurement id is set; even then nothing is sent
    // until the visitor has said yes, and what is sent is fixed words and numbers, never the board.
    start('board');
    const text = textFromLocation();
    const url = text === null ? null : normaliseLink(text);
    if (url === null) {
        // Ours by shape but a format this page does not read: ask the visitor to update. Anything else
        // that is not a board link gets the "check the whole link was copied" card.
        if (text !== null && classifyLink(text) === 'newer') {
            track('web_board_open', { res: 'bad_link', why: 'newer' });
            failWith('newer', new Error('link version this page does not read'));
            return;
        }
        const why = text === null ? 'no_board' : 'not_a_link';
        track('web_board_open', { res: 'bad_link', why });
        fail('No board in this link', 'A GroupIt board link looks like ' + Head + '… — check the whole link was copied, ' +
            'including everything after the last slash.');
        return;
    }
    let puzzle;
    try {
        puzzle = await fromLink(url);
    }
    catch (e) {
        // A newer rule or clue, a browser too old to inflate, or a plainly broken link: three cards.
        track('web_board_open', { res: 'bad_link', why: decodeWhy(e) });
        failWith(troubleOf(e), e);
        return;
    }
    const play = new PlayBoard(puzzle);
    const canvas = $('canvas');
    const view = new BoardView(canvas, play, { onChange: refresh });
    $('size').textContent = sizeText(puzzle.rows, puzzle.cols);
    // The app's own name for the rule (src/ui/names.ts), or no chip: an engine identifier is not a
    // word any player has seen, and the plain game has no rule to name.
    const rule = modeName(puzzle.mechanic);
    // The same name, as an event value: the app's word for the rule, or `none`. Size, difficulty and rule
    // only (all three are in the link's header, none of them is the board); the board itself never leaves this page.
    const ruleWord = ruleValue(rule);
    track('web_board_open', { res: 'ok', rows: puzzle.rows, cols: puzzle.cols, diff: puzzle.difficulty, rule: ruleWord });
    const ruleChip = $('rule');
    ruleChip.hidden = rule === null;
    if (rule !== null)
        ruleChip.textContent = rule;
    show('board');
    bindToneToggle($('tone'), view);
    view.resize();
    const shownAt = performance.now();
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
            // 2026-10-05: no stars and no "Flawless" — the app has neither (it pays gems, and one more for
            // "a perfect run"), and this card is the first thing a friend who was sent a board sees of the
            // game. It says what the board was, in the app's words, and keeps the celebration short.
            // `withdrew` counts a reset the same way the app does: undo and reset both take it.
            const perfect = isPerfect(true, play.everWrong, withdrew);
            track('web_board_solved', {
                kind: 'shared', rows: puzzle.rows, cols: puzzle.cols, diff: puzzle.difficulty, rule: ruleWord,
                tb: solveBucket(performance.now() - shownAt), perfect: perfect ? 1 : 0,
            });
            $('winTitle').textContent = perfect ? 'A perfect run' : 'Solved';
            $('winBoard').textContent = boardLine(puzzle.rows, puzzle.cols, puzzle.mechanic);
            $('winNote').hidden = !perfect;
            $('winNote').textContent = 'No undo, no reset, no cell left on the wrong tone.';
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
            catch (e) {
                // Cancelling the share sheet is the player's answer, not a failure: do nothing. (It used to
                // fall through to the copy prompt, so cancelling on iOS opened a second dialog, 2026-10-05.)
                // Only a real failure — NotAllowedError, no share target — goes on to copy.
                if (isShareDismissed(e))
                    return;
            }
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
    addEventListener('hashchange', () => {
        // A second link opened in this tab swaps the fragment and nothing else, so the page reloads to
        // deal the new board — and a reload restores the scroll offset. A tab that had just been solved
        // is scrolled down to the win card (scrollIntoView, above), so the next board used to open
        // already scrolled past its own stage (2026-10-05). `manual` stops the browser restoring the old
        // offset on the reload below, and the scrollTo is the belt for a browser that restores anyway.
        // Both are plain DOM and work in iOS Safari (11+) and Chrome. The property sits on this history
        // entry only, so Back to any earlier page keeps its own scroll.
        history.scrollRestoration = 'manual';
        scrollTo(0, 0);
        location.reload();
    });
    refresh();
}
main().catch((e) => {
    const why = explain('page', e);
    fail(why.title, why.body);
});
//# sourceMappingURL=play.js.map
// The landing page's playable board.
//
// The page opens in a working state rather than describing one — a visitor can tap a cell before
// they have read a word, and the rules underneath are far easier to read once they have. That
// means the board must be a REAL board with a real answer, not a drawing of one, so it comes
// through the same PlayBoard and the same rules as everything else.
import { PlayBoard } from '../core/playBoard.js';
import { Puzzle } from '../core/puzzle.js';
import { isPerfect } from '../core/scoring.js';
import { BoardView } from './board.js';
import { bindToneToggle } from './tone.js';
import { SAMPLE } from './sample.js';
import { explain } from './errors.js';
const $ = (id) => document.getElementById(id);
function main() {
    let puzzle;
    try {
        puzzle = Puzzle.fromLine(SAMPLE);
    }
    catch (e) {
        // The reason goes to the console, not onto the page (src/ui/errors.ts).
        const why = explain('sample', e);
        $('loading').hidden = true;
        $('errorTitle').textContent = why.title;
        $('errorBody').textContent = why.body;
        $('error').hidden = false;
        return;
    }
    const play = new PlayBoard(puzzle);
    const view = new BoardView($('canvas'), play, { onChange: refresh });
    $('loading').hidden = true;
    $('board').hidden = false;
    bindToneToggle($('tone'), view);
    view.resize();
    let won = false, withdrew = false;
    function refresh() {
        const status = play.status;
        const left = puzzle.playableCells - status.committed;
        $('left').textContent = left === 0 ? 'every cell filled' : `${left} to go`;
        const broken = status.brokenClueCount + status.brokenLawCount;
        $('warn').hidden = broken === 0;
        if (broken > 0)
            $('warn').textContent = 'Something here cannot work';
        $('undo').disabled = !play.canUndo;
        if (status.solved && !won) {
            won = true;
            // 2026-10-05: no stars, no "Flawless". The app has neither any more — it pays gems, and one
            // more for "a perfect run" — so the card says what happened in the app's own words. The old
            // note here, "There are 1,071 more", was the retired campaign's board count and had been
            // wrong since round 24; the app's free play is endless, so the card points at the game
            // rather than at a number that goes stale on the next re-bake.
            const perfect = isPerfect(true, play.everWrong, withdrew);
            $('winTitle').textContent = perfect ? 'A perfect run' : 'Solved';
            $('winNote').textContent = perfect
                ? 'No undo, no reset, no cell left on the wrong tone.'
                : 'A perfect run is a solve with no undo, no reset and no cell left on the wrong tone.';
            $('win').hidden = false;
            // The board fills a phone screen, so the card lands below the fold and a player who just
            // finished sees nothing happen. Scroll it up — honouring reduced-motion, because a jump
            // the size of a screen is exactly what that setting is about.
            const motion = matchMedia('(prefers-reduced-motion: reduce)').matches;
            $('win').scrollIntoView({ behavior: motion ? 'auto' : 'smooth', block: 'center' });
        }
    }
    $('undo').addEventListener('click', () => { withdrew = true; view.undo(); });
    $('reset').addEventListener('click', () => {
        withdrew = true;
        won = false;
        $('win').hidden = true;
        view.reset();
    });
    addEventListener('resize', () => view.resize());
    refresh();
}
main();
//# sourceMappingURL=landing.js.map
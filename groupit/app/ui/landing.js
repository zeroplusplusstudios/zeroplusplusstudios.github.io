import { PlayBoard } from '../core/playBoard.js';
import { Puzzle } from '../core/puzzle.js';
import { isPerfect } from '../core/scoring.js';
import { BoardView } from './board.js';
import { bindToneToggle } from './tone.js';
import { SAMPLE } from './sample.js';
import { explain } from './errors.js';
import { modeName } from './names.js';
import { ruleValue, solveBucket, start, track } from './analytics.js';
import { fitBadges } from './stores.js';
const $ = (id) => document.getElementById(id);
function main() {
    start('landing');
    fitBadges($('badges'), false);
    let puzzle;
    try {
        puzzle = Puzzle.fromLine(SAMPLE);
    }
    catch (e) {
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
    const shownAt = performance.now();
    let won = false, withdrew = false;
    function refresh() {
        const status = play.status;
        const left = puzzle.playableCells - status.committed;
        $('left').textContent = status.solved ? 'Solved' : left === 0 ? 'every cell filled' : `${left} to go`;
        $('left').classList.toggle('done', status.solved);
        const broken = status.brokenClueCount + status.brokenLawCount;
        $('warn').hidden = broken === 0;
        if (broken > 0)
            $('warn').textContent = 'Something here cannot work';
        $('undo').disabled = !play.canUndo;
        if (status.solved && !won) {
            won = true;
            const perfect = isPerfect(true, play.everWrong, withdrew);
            track('web_board_solved', {
                kind: 'sample', rows: puzzle.rows, cols: puzzle.cols, diff: puzzle.difficulty, rule: ruleValue(modeName(puzzle.mechanic)),
                tb: solveBucket(performance.now() - shownAt), perfect: perfect ? 1 : 0,
            });
        }
    }
    $('undo').addEventListener('click', () => { withdrew = true; view.undo(); });
    $('reset').addEventListener('click', () => {
        withdrew = true;
        won = false;
        view.reset();
    });
    addEventListener('resize', () => view.resize());
    refresh();
}
main();

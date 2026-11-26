import { fromLink, classifyLink, normaliseLink, link as makeLink, Head, HeadBase } from '../core/shareCodec.js';
import { PlayBoard } from '../core/playBoard.js';
import { isPerfect } from '../core/scoring.js';
import { BoardView } from './board.js';
import { bindToneToggle } from './tone.js';
import { boardLine, modeName, sizeText } from './names.js';
import { decodeWhy, explain, isShareDismissed, troubleOf } from './errors.js';
import { ruleValue, solveBucket, start, track } from './analytics.js';
import { hasRuleCard, lessonDone, ruleSeen, runWalkthrough, showHelp, showRuleCard } from './teach.js';
import { fitBadges } from './stores.js';
import { HintKind, LadderSolver, withLadderSolution } from '../core/deduction.js';
import { cellIndex } from '../core/clue.js';
import { Mark } from '../core/types.js';
import { hintLines } from '../content/hintLines.js';
const $ = (id) => document.getElementById(id);
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
    $('size').hidden = true;
    $('errorTitle').textContent = message;
    $('errorBody').textContent = detail;
    show('error');
}
function failWith(kind, e) {
    const why = explain(kind, e);
    fail(why.title, why.body);
}
async function main() {
    start('board');
    const text = textFromLocation();
    const url = text === null ? null : normaliseLink(text);
    if (url === null) {
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
        track('web_board_open', { res: 'bad_link', why: decodeWhy(e) });
        failWith(troubleOf(e), e);
        return;
    }
    const play = new PlayBoard(puzzle);
    const canvas = $('canvas');
    const view = new BoardView(canvas, play, { onChange: refresh });
    $('size').textContent = sizeText(puzzle.rows, puzzle.cols);
    const rule = modeName(puzzle.mechanic);
    const ruleWord = ruleValue(rule);
    track('web_board_open', { res: 'ok', rows: puzzle.rows, cols: puzzle.cols, diff: puzzle.difficulty, rule: ruleWord });
    const ruleChip = $('rule');
    ruleChip.hidden = rule === null;
    if (rule !== null)
        ruleChip.textContent = rule;
    bindToneToggle($('tone'), view);
    fitBadges($('badges'), true);
    const teachHost = $('teach');
    const help = $('help');
    const chips = document.querySelector('.chips');
    let teaching = null;
    let won = false;
    let shownAt = -1;
    let scrolledTo = 0;
    function showBoard() {
        const back = teaching !== null;
        teaching = null;
        teachHost.hidden = true;
        teachHost.replaceChildren();
        show('board');
        $('solved').hidden = !won;
        help.hidden = false;
        chips.hidden = false;
        view.resize();
        if (back)
            scrollTo(0, scrolledTo);
        if (shownAt < 0)
            shownAt = performance.now();
    }
    function teach(open) {
        if (teaching === null)
            scrolledTo = scrollY;
        $('board').hidden = true;
        $('loading').hidden = true;
        $('solved').hidden = true;
        help.hidden = true;
        chips.hidden = true;
        teachHost.hidden = false;
        teaching = open(teachHost, showBoard);
        if (teaching === null)
            showBoard();
        else
            scrollTo(0, 0);
    }
    const mechanic = puzzle.mechanic;
    const ruleCardOwed = () => hasRuleCard(mechanic) && !ruleSeen(mechanic);
    const card = (host, then) => showRuleCard(host, mechanic, { onClose: then });
    help.addEventListener('click', () => {
        if (teaching !== null)
            return;
        teach((host, then) => showHelp(host, mechanic, then));
    });
    if (!lessonDone()) {
        const afterWalk = () => {
            if (ruleCardOwed())
                teach(card);
            else
                showBoard();
        };
        teach((host) => runWalkthrough(host, { onDone: afterWalk, onSkip: afterWalk }));
    }
    else if (ruleCardOwed()) {
        teach(card);
    }
    else {
        showBoard();
    }
    const share = $('share');
    const shareLabel = share.textContent ?? 'Share this board';
    function shareInStrip(inStrip) {
        if (inStrip) {
            $('shareSlot').appendChild(share);
            share.textContent = 'Share';
        }
        else {
            $('actions').appendChild(share);
            share.textContent = shareLabel;
        }
    }
    let ladder = null;
    const hintLine = $('hintLine');
    function clearHint() {
        hintLine.hidden = true;
        view.clearRings();
    }
    $('hint').addEventListener('click', () => {
        ladder ??= new LadderSolver(withLadderSolution(puzzle));
        const marks = new Uint8Array(play.cellCount);
        play.copyMarksTo(marks);
        const hint = ladder.advise(marks, play.lastMarked);
        view.clearRings();
        if (hint.cell >= 0)
            view.ring(hint.cell, hint.kind === HintKind.Mistake ? 'slip' : 'target');
        if (hint.clueIndex >= 0) {
            const at = cellIndex(puzzle.clues[hint.clueIndex], puzzle.cols);
            if (at >= 0 && at !== hint.cell)
                view.ring(at, 'focus');
        }
        const lines = hintLines(hint, puzzle, marks, view.firstTone === Mark.Light, view.firstTone);
        $('hintReason').textContent = lines.reason;
        $('hintGesture').textContent = lines.gesture ?? '';
        hintLine.hidden = false;
    });
    function refresh() {
        clearHint();
        const status = play.status;
        const left = puzzle.playableCells - status.committed;
        $('left').textContent = status.solved ? '' : left === 0 ? 'every cell filled' : `${left} to go`;
        const broken = status.brokenClueCount + status.brokenLawCount;
        const warn = $('warn');
        warn.hidden = broken === 0;
        if (broken > 0)
            warn.textContent = broken === 1 ? 'Something here cannot work' : `${broken} things here cannot work`;
        $('undo').disabled = !play.canUndo;
        $('hint').hidden = status.solved;
        if (status.solved && !won) {
            won = true;
            const perfect = isPerfect(true, play.everWrong, withdrew);
            track('web_board_solved', {
                kind: 'shared', rows: puzzle.rows, cols: puzzle.cols, diff: puzzle.difficulty, rule: ruleWord,
                tb: solveBucket(performance.now() - (shownAt < 0 ? performance.now() : shownAt)), perfect: perfect ? 1 : 0,
            });
            $('solvedBoard').textContent = boardLine(puzzle.rows, puzzle.cols, puzzle.mechanic);
            shareInStrip(true);
            $('solved').hidden = false;
        }
    }
    let withdrew = false;
    $('undo').addEventListener('click', () => { withdrew = true; view.undo(); });
    $('reset').addEventListener('click', () => {
        withdrew = true;
        $('solved').hidden = true;
        shareInStrip(false);
        won = false;
        view.reset();
    });
    $('share').addEventListener('click', async () => {
        const mine = await makeLink(puzzle);
        const address = location.origin + location.pathname + '#' + mine.slice(HeadBase.length);
        const text = 'Try this GroupIt board: ' + address;
        if (navigator.share !== undefined) {
            try {
                await navigator.share({ text });
                return;
            }
            catch (e) {
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

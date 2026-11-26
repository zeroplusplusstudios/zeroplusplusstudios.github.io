import { cellIndex } from '../core/clue.js';
import { HintKind } from '../core/deduction.js';
import { Mechanic } from '../core/mechanic.js';
import { Mark, Tone, toneToMark } from '../core/types.js';
import { isHold } from './walkthrough.js';
const word = (t) => (t === Tone.Gold ? 'gold' : t === Tone.Light ? 'light' : 'dark');
export function hintLines(hint, puzzle, marks, lightFirst = false, goldBrush) {
    return { reason: hint.text, gesture: gestureFor(hint, puzzle, marks, lightFirst, goldBrush) };
}
function gestureFor(hint, puzzle, marks, lightFirst, goldBrush) {
    if (hint.cell < 0)
        return null;
    if (hint.kind === HintKind.Mistake) {
        const onClue = hint.clueIndex >= 0 && cellIndex(puzzle.clues[hint.clueIndex], puzzle.cols) === hint.cell;
        if (onClue || marks[hint.cell] === Mark.Unknown)
            return null;
        return 'Tap it to clear it.';
    }
    if (hint.kind !== HintKind.Move)
        return null;
    const want = toneToMark(hint.tone);
    if (puzzle.mechanic === Mechanic.GoldHour) {
        const brush = goldBrush ?? (lightFirst ? Mark.Light : Mark.Shadow);
        if (hint.tone === Tone.Gold)
            return brush === Mark.Gold ? 'Tap it for gold.' : 'Set Tap to Gold, then tap it.';
        const hold = brush === Mark.Shadow ? Mark.Light : Mark.Shadow;
        if (want === brush)
            return `Tap it for ${word(hint.tone)}.`;
        if (want === hold)
            return `Press and hold it for ${word(hint.tone)}.`;
        return `Set Tap to ${word(hint.tone) === 'dark' ? 'Dark' : 'Light'}, then tap it.`;
    }
    return isHold(want, lightFirst) ? `Press and hold it for ${word(hint.tone)}.` : `Tap it for ${word(hint.tone)}.`;
}

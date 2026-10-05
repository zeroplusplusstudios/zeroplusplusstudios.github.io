// The tone toggle: which tone a tap paints.
//
// The app has this as a board-screen control writing Preferences.LightFirst, and it can afford
// to teach the hold gesture instead over 1,072 boards. This page gets one board and a visitor
// who has never seen the game — and a visitor who cannot find Light by tapping concludes the
// board is broken, not that they missed a gesture. So the choice is on the screen.
//
// Shared by both pages so the control and the swatches cannot drift apart.
import { Mark } from '../core/types.js';
import { Mechanic } from '../core/mechanic.js';
import { Slate, inkOn } from './palette.js';
const KEY = 'groupit.firstTone';
/**
 * The tones a tap can be set to on a board of this mechanic, in the order the toggle steps
 * through them. Shadow first, as the page has always opened.
 *
 * **A Gold Hour board has a third one** (2026-10-05). Gold is a free-play mode in the app, so a
 * Gold board is a share link like any other, and its answer is full of the third tone. The page's
 * gestures were tap = one tone, hold = the other, and the toggle swapped those two — Gold could
 * not be painted, so the board was dealt, drawn and impossible to finish. The app has a
 * three-tone brush for exactly this (`GameScreen.BuildGoldPicker`, `BoardView.GoldBrush`); this is
 * its page-sized twin: the toggle steps Shadow, Light, Gold, and a tap paints the one showing. A
 * hold still paints the other of Shadow and Light (`BoardView.otherTone`), which is all it can
 * mean with three. `test/tones.ts` plays every shipped board with these lists and fails if one of
 * them leaves a tone an answer uses unpaintable.
 */
export function tonesFor(mechanic) {
    return mechanic === Mechanic.GoldHour ? [Mark.Shadow, Mark.Light, Mark.Gold] : [Mark.Shadow, Mark.Light];
}
const NAMES = new Map([
    [Mark.Shadow, 'Shadow'], [Mark.Light, 'Light'], [Mark.Gold, 'Gold'],
]);
const FILLS = new Map([
    [Mark.Shadow, Slate.ink], [Mark.Light, Slate.lit], [Mark.Gold, Slate.accent],
]);
/**
 * Wire a button to the tap tone. The choice is remembered per browser — wrapped, because
 * localStorage throws outright in some contexts (a private window, a thumbnailer, a browser set
 * to block site data) and a board that will not open because a preference could not be read is
 * a far worse failure than a preference that does not stick.
 *
 * A remembered tone the board does not offer — "gold", from a Gold board, read on a plain one —
 * is ignored rather than honoured: it would leave the tap painting a tone the rules of this board
 * do not have.
 */
export function bindToneToggle(button, view) {
    const tones = () => tonesFor(view.play.puzzle.mechanic);
    let tone = Mark.Shadow;
    try {
        const saved = localStorage.getItem(KEY);
        const wanted = [...NAMES.entries()].find(([, name]) => name.toLowerCase() === saved)?.[0];
        if (wanted !== undefined && tones().includes(wanted))
            tone = wanted;
    }
    catch { /* no storage; the default stands */ }
    const next = () => {
        const ring = tones();
        return ring[(ring.indexOf(tone) + 1) % ring.length];
    };
    const paint = () => {
        view.firstTone = tone;
        const fill = FILLS.get(tone);
        button.innerHTML =
            `<span class="swatch" style="background:${fill};color:${inkOn(fill)}">${NAMES.get(tone)}</span>`;
        button.setAttribute('aria-label', `Tap paints ${NAMES.get(tone)}. Press to paint ${NAMES.get(next())} instead.`);
    };
    button.addEventListener('click', () => {
        tone = next();
        try {
            localStorage.setItem(KEY, NAMES.get(tone).toLowerCase());
        }
        catch { /* see above */ }
        paint();
    });
    paint();
}
//# sourceMappingURL=tone.js.map
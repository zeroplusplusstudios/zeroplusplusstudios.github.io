// The tone toggle: which tone a tap paints.
//
// The app has this as a board-screen control writing Preferences.LightFirst, and it can afford
// to teach the hold gesture instead over 1,072 boards. This page gets one board and a visitor
// who has never seen the game — and a visitor who cannot find Light by tapping concludes the
// board is broken, not that they missed a gesture. So the choice is on the screen.
//
// Shared by both pages so the control and the swatches cannot drift apart.
import { Mark } from '../core/types.js';
import { Slate } from './palette.js';
const KEY = 'groupit.firstTone';
/**
 * Wire a button to the tap tone. The choice is remembered per browser — wrapped, because
 * localStorage throws outright in some contexts (a private window, a thumbnailer, a browser set
 * to block site data) and a board that will not open because a preference could not be read is
 * a far worse failure than a preference that does not stick.
 */
export function bindToneToggle(button, view) {
    let light = false;
    try {
        light = localStorage.getItem(KEY) === 'light';
    }
    catch { /* no storage; the default stands */ }
    const paint = () => {
        view.firstTone = light ? Mark.Light : Mark.Shadow;
        const fill = light ? Slate.lit : Slate.ink;
        const ink = light ? Slate.ink : Slate.lit;
        button.innerHTML =
            `<span class="swatch" style="background:${fill};color:${ink}">${light ? 'Light' : 'Shadow'}</span>`;
        button.setAttribute('aria-label', `Tap paints ${light ? 'Light' : 'Shadow'}. Press to paint ${light ? 'Shadow' : 'Light'} instead.`);
    };
    button.addEventListener('click', () => {
        light = !light;
        try {
            localStorage.setItem(KEY, light ? 'light' : 'shadow');
        }
        catch { /* see above */ }
        paint();
    });
    paint();
}
//# sourceMappingURL=tone.js.map
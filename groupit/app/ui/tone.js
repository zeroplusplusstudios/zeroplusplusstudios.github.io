import { Mark } from '../core/types.js';
import { Mechanic } from '../core/mechanic.js';
import { Slate, inkOn } from './palette.js';
const KEY = 'groupit.firstTone';
export function tonesFor(mechanic) {
    return mechanic === Mechanic.GoldHour ? [Mark.Shadow, Mark.Light, Mark.Gold] : [Mark.Shadow, Mark.Light];
}
const NAMES = new Map([
    [Mark.Shadow, 'Dark'], [Mark.Light, 'Light'], [Mark.Gold, 'Gold'],
]);
const FILLS = new Map([
    [Mark.Shadow, Slate.ink], [Mark.Light, Slate.lit], [Mark.Gold, Slate.accent],
]);
export function bindToneToggle(button, view) {
    const tones = () => tonesFor(view.play.puzzle.mechanic);
    let tone = Mark.Shadow;
    try {
        const saved = localStorage.getItem(KEY);
        const wanted = saved === 'shadow' ? Mark.Shadow
            : [...NAMES.entries()].find(([, name]) => name.toLowerCase() === saved)?.[0];
        if (wanted !== undefined && tones().includes(wanted))
            tone = wanted;
    }
    catch { }
    const next = () => {
        const ring = tones();
        return ring[(ring.indexOf(tone) + 1) % ring.length];
    };
    const paint = () => {
        view.firstTone = tone;
        const fill = FILLS.get(tone);
        button.innerHTML =
            `<span class="tap">Tap</span><span class="swatch" style="background:${fill};color:${inkOn(fill)}">${NAMES.get(tone)}</span>`;
        button.setAttribute('aria-label', `Tap paints ${NAMES.get(tone)}. Press to paint ${NAMES.get(next())} instead.`);
    };
    button.addEventListener('click', () => {
        tone = next();
        try {
            localStorage.setItem(KEY, NAMES.get(tone).toLowerCase());
        }
        catch { }
        paint();
    });
    view.onTapTone((now) => {
        if (now === tone)
            return;
        tone = now;
        paint();
    });
    paint();
}

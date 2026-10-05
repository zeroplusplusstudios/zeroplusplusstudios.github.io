// What the APP calls each rule, so a shared board's chip says the word its sender saw.
//
// Added 2026-10-05. The shared-board page's rule chip used to print the web port's enum names,
// spaced out: "Well", "Gold Hour", "Unlit Numeral", "One Sky", "Twice Told", "Windowlight",
// "Turnstile", "Watch". Those are identifiers in `Mechanic.cs`, chosen when the rules were
// engine concepts, and not one of them is a word the app shows a player. The app calls the same
// rules Holes, Gold, Colourless, Connected, Double, Rectangles, Turns and Neighbours — so a friend
// who sent a Holes board and opened it to check it arrived read "Well", and had no reason to
// believe it was the same board.
//
// **A link carries a board's `Mechanic` and nothing else** (`ShareCodec`: no row, no chapter), so
// a name can only be looked up by mechanic. The app's names live on rows, and a row is a mode:
//
//   · The free-play shelf (`EndlessModes.Authored`) is what a player is dealt today, and its ten
//     mechanic-carrying rows are the nine names below plus the plain game. These are SHELF names.
//   · Seven mechanics left the shelf in the 2026-09/10 cuts but a link of one still opens in the
//     app (the dormant lesson pages exist for exactly that board). Their last names are the
//     retired campaign's chapter titles, frozen in `LegacyCampaign.Rows`: Lamps, Sight, Knight,
//     Crossroads, Biggest, Pairs, Perimeter. These are RETIRED names.
//   · Everything else (Duskfall, Never Three, the Weir, the Scales ...) was deleted outright and
//     the app has no word for it: a shared board of one reads "A shared board" there, and the
//     chip is hidden here for the same reason — printing an engine identifier would be inventing
//     a name nobody has seen.
//
// **Uniform is the one shelf mode a link cannot name**: its rule is a promise about the whole
// board ("every number is the same number") and its boards carry no mechanic, so a Uniform board
// and a Classic one arrive identical. `test/names.ts` fails if a second mechanic-less rule ever
// joins the shelf, so that assumption cannot go stale quietly. The same is why a plain board shows
// no mode name at all rather than "Classic" — it would be wrong for every Uniform board.
//
// `test/names.ts` reads every title in this file out of the C# (EndlessModes.cs,
// LegacyCampaign.cs) and out of the pool the app ships, so a rename on the app side fails the web
// build instead of drifting.
import { Mechanic } from '../core/mechanic.js';
export const MODE_NAMES = [
    // ── the free-play shelf, in the shelf's order ───────────────────────────────────────────────
    { mechanic: Mechanic.Ledger, name: 'Tally', source: 'shelf' },
    { mechanic: Mechanic.UnlitNumeral, name: 'Colourless', source: 'shelf' },
    { mechanic: Mechanic.OneSky, name: 'Connected', source: 'shelf' },
    { mechanic: Mechanic.GoldHour, name: 'Gold', source: 'shelf' },
    { mechanic: Mechanic.Turnstile, name: 'Turns', source: 'shelf' },
    { mechanic: Mechanic.Watch, name: 'Neighbours', source: 'shelf' },
    { mechanic: Mechanic.Windowlight, name: 'Rectangles', source: 'shelf' },
    { mechanic: Mechanic.TwiceTold, name: 'Double', source: 'shelf' },
    { mechanic: Mechanic.Well, name: 'Holes', source: 'shelf' },
    // ── off the shelf, still openable from a link ───────────────────────────────────────────────
    { mechanic: Mechanic.StrayLight, name: 'Lamps', source: 'retired', legacyCode: 23 },
    { mechanic: Mechanic.LanternReach, name: 'Sight', source: 'retired', legacyCode: 25 },
    { mechanic: Mechanic.LongStep, name: 'Knight', source: 'retired', legacyCode: 33 },
    { mechanic: Mechanic.Crossroads, name: 'Crossroads', source: 'retired', legacyCode: 34 },
    { mechanic: Mechanic.BigHouse, name: 'Biggest', source: 'retired', legacyCode: 35 },
    { mechanic: Mechanic.LikeForLike, name: 'Pairs', source: 'retired', legacyCode: 36 },
    { mechanic: Mechanic.Shoreline, name: 'Perimeter', source: 'retired', legacyCode: 37 },
];
const BY_MECHANIC = new Map(MODE_NAMES.map(m => [m.mechanic, m.name]));
/**
 * The app's name for a board's rule, or null when the app has none to show: the plain game (and
 * Uniform, which a link cannot tell from it) and the rules the app deleted outright.
 */
export function modeName(mechanic) {
    return BY_MECHANIC.get(mechanic) ?? null;
}
/** "6 × 5" — a board's size the way both pages print it, rows by columns. */
export function sizeText(rows, cols) {
    return `${rows} × ${cols}`;
}
/**
 * What a finished board was, for the win card: "6 × 5 · Tally", or just "4 × 4" when there is no
 * rule to name. A line of facts rather than a sentence on purpose — "a 6 × 5" and "an 8 × 7" need
 * different articles, and a page that cannot say which is better off not having one.
 */
export function boardLine(rows, cols, mechanic) {
    const rule = modeName(mechanic);
    return rule === null ? sizeText(rows, cols) : `${sizeText(rows, cols)} · ${rule}`;
}
//# sourceMappingURL=names.js.map
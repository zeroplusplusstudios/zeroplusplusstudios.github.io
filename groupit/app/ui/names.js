import { Mechanic } from '../core/mechanic.js';
export const MODE_NAMES = [
    { mechanic: Mechanic.Ledger, name: 'Tally', source: 'shelf' },
    { mechanic: Mechanic.UnlitNumeral, name: 'Colourless', source: 'shelf' },
    { mechanic: Mechanic.OneSky, name: 'Connected', source: 'shelf' },
    { mechanic: Mechanic.GoldHour, name: 'Gold', source: 'shelf' },
    { mechanic: Mechanic.Turnstile, name: 'Turns', source: 'shelf' },
    { mechanic: Mechanic.Watch, name: 'Neighbours', source: 'shelf' },
    { mechanic: Mechanic.Windowlight, name: 'Rectangles', source: 'shelf' },
    { mechanic: Mechanic.TwiceTold, name: 'Double', source: 'shelf' },
    { mechanic: Mechanic.Well, name: 'Holes', source: 'shelf' },
    { mechanic: Mechanic.StrayLight, name: 'Lamps', source: 'retired', legacyCode: 23 },
    { mechanic: Mechanic.LanternReach, name: 'Sight', source: 'retired', legacyCode: 25 },
    { mechanic: Mechanic.LongStep, name: 'Knight', source: 'retired', legacyCode: 33 },
    { mechanic: Mechanic.Crossroads, name: 'Crossroads', source: 'retired', legacyCode: 34 },
    { mechanic: Mechanic.BigHouse, name: 'Biggest', source: 'retired', legacyCode: 35 },
    { mechanic: Mechanic.LikeForLike, name: 'Pairs', source: 'retired', legacyCode: 36 },
    { mechanic: Mechanic.Shoreline, name: 'Perimeter', source: 'retired', legacyCode: 37 },
];
const BY_MECHANIC = new Map(MODE_NAMES.map(m => [m.mechanic, m.name]));
export function modeName(mechanic) {
    return BY_MECHANIC.get(mechanic) ?? null;
}
export function sizeText(rows, cols) {
    return `${rows} × ${cols}`;
}
export function boardLine(rows, cols, mechanic) {
    const rule = modeName(mechanic);
    return rule === null ? sizeText(rows, cols) : `${sizeText(rows, cols)} · ${rule}`;
}

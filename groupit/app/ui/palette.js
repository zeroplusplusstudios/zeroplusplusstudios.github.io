export const Slate = {
    lit: '#ECECE6',
    givenLit: '#D2D4C8',
    ink: '#15171C',
    givenInk: '#242833',
    accent: '#E8B45A',
    unknown: '#4A4F59',
};
export const Board = {
    card: '#262523',
    textOnGold: '#1A1C21',
    broken: '#C4453C',
    brokenWash: 0.16,
    holeRim: '#7A8190',
    marginFace: '#FFFFFF',
    marginBorder: '#15171C',
    star: '#FFC23D',
};
export const Chrome = {
    backdropDay: '#F6F3EA',
    panelDay: '#FFFFFF',
    inkDay: '#2A1A5E',
    mutedDay: '#655E7C',
    brokenOnLight: '#A8082E',
    brokenOnDark: '#FFB9B2',
};
export const GroupOnLight = ['#0E55A8', '#794E03', '#822BAE', '#066259', '#4F5C32', '#156520'];
export const GroupOnDark = ['#4D96E9', '#C78616', '#BF75E5', '#26A597', '#869C55', '#2CA93D'];
export function groupInk(light, slot) {
    const n = GroupOnLight.length;
    const at = ((slot % n) + n) % n;
    return light ? GroupOnLight[at] : GroupOnDark[at];
}
export function brokenInk(onLight) {
    return onLight ? Chrome.brokenOnLight : Chrome.brokenOnDark;
}
export function inkOn(fill) {
    if (fill === Slate.accent)
        return Board.textOnGold;
    return fill === Slate.lit || fill === Slate.givenLit ? Slate.ink : Slate.lit;
}
export function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (p, s) => (p >> s) & 0xff;
    const out = [16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t));
    return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

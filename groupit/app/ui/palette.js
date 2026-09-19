// The board's colours, copied from the shipped Slate theme.
//
// These are the five values ColourThemes.cs calls "the tones already on the board" plus the
// chrome Palette.cs derives around them. Copied rather than computed, exactly as that file
// copies them from Palette: this is a TABLE, and a row that reaches somewhere else for its
// values cannot be compared with the rows beside it.
//
// `ColourThemeTests.SlateIsTheShippedBoard` pins the five on the C# side. They must not drift
// here either — a board on the web that is a different colour from the same board in the app is
// a board the player does not recognise as theirs.
export const Slate = {
    /** CellLight — the lit tone. */
    lit: '#ECECE6',
    /** GivenLit — a lit cell the clue handed the player, so slightly knocked back. */
    givenLit: '#D2D4C8',
    /** CellShadow — the dark tone. */
    ink: '#15171C',
    /** GivenInk — a dark cell the clue handed the player. */
    givenInk: '#242833',
    /** Star / CellGold — the accent, and the third tone on a Gold Hour board. */
    accent: '#E8B45A',
    /** CellUnknown — deliberately BETWEEN the two tones in brightness: it means "not yet decided". */
    unknown: '#4A4F59',
};
export const Chrome = {
    backdropDay: '#F4F3EE',
    backdropNight: '#1B1D22',
    panelDay: '#FFFFFF',
    panelNight: '#262930',
    inkDay: '#1B1D22',
    inkNight: '#F0F1EC',
    mutedDay: '#5F6573',
    mutedNight: '#8A919E',
    /** The contradiction colour, one per ground. Small text, so both clear 4.5:1 on their own. */
    brokenOnLight: '#A8082E',
    brokenOnDark: '#FFB9B2',
};
/** Ink that reads on a given cell fill. Mirrors Palette.TextOnLight / TextOnShadow. */
export function inkOn(fill) {
    return fill === Slate.lit || fill === Slate.givenLit || fill === Slate.accent
        ? Slate.ink : Slate.lit;
}
//# sourceMappingURL=palette.js.map
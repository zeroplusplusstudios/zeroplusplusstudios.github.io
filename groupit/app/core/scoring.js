// Ported from Assets/_Project/Scripts/Core/Play/Scoring.cs
//
// Three independent stars, not a ladder: a player can hold the third without the second. Every
// sentence below is the only statement of its rule, so they live beside Rate rather than in the
// UI — a change to the scoring cannot leave one of them describing the old rules.
export const MaxStars = 3;
export function rate(solved, everWrong, everWithdrew) {
    return !solved ? 0 : 1 + (everWrong ? 0 : 1) + (everWithdrew ? 0 : 1);
}
/**
 * Short phrase for the star tier, for the win banner. Index 0 is unsolved.
 *
 * Two stars is "Well played" rather than "Clean", because two stars is reachable two ways — a
 * spotless run that undid something, or a run with a wrong cell that never took anything back.
 * One star is "Got there" and not "Solved", because "Solved" was on the card three times and the
 * word is also the CONDITION for star one.
 */
export function praise(stars) {
    return stars >= 3 ? 'Flawless'
        : stars === 2 ? 'Well played'
            : stars === 1 ? 'Got there' : '';
}
/**
 * What ONE star asks of the player, in the player's words. Index 1..3 — the star, not a tier.
 * Each line states one star's whole condition and none of them leans on the line above. All
 * three say "solve it" because rate pays nothing whatsoever for an unfinished board: that is the
 * floor under every star, not the second and third building on the first.
 */
export function requirement(stars) {
    return stars >= 3 ? 'Solve it with no undo and no reset. Right the first time.'
        : stars === 2 ? 'Solve it leaving no cell on a tone the answer does not have.'
            : stars === 1 ? 'Solve the board.' : '';
}
/**
 * What the player would have to do to earn a star this run missed, or null when it missed
 * neither. With both gone it names the wrong-tone one: a player still leaving cells on the wrong
 * tone is not a player who needs to hear about undo yet.
 *
 * Note what the second-star line does NOT say. It is not "without putting a cell in the wrong
 * place" — a cell only counts once the player moves on and leaves it, so correcting yourself
 * where you stand is free, and the earlier wording had people avoiding a penalty that does not
 * exist while walking into one that does.
 */
export function nextStarHint(everWrong, everWithdrew) {
    return everWrong ? 'Leave no cell on the wrong tone — fixing one before you move on is free'
        : everWithdrew ? 'Solve it with no undo and no reset for the third star'
            : null;
}
/** The most stars a set of boards can yield. */
export function available(boardCount) {
    return Math.max(0, boardCount) * MaxStars;
}
//# sourceMappingURL=scoring.js.map
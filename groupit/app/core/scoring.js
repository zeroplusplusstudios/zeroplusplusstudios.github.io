// Ported from Assets/_Project/Scripts/Core/Play/Scoring.cs
//
// **Only the rule survives, and that is the point of what is missing (2026-10-05).** The app
// stopped showing stars on 2026-10-04 and removed the win card and its rating on round 32, and
// Core deleted `Requirement` and both `NextStarHint`s the same day. This file had carried all of
// them for the two pages' win cards, which is how the landing page and the shared-board page came
// to say "Flawless" and "Well played" and print three stars for a game that has none: a port that
// keeps a function Core deleted keeps the old game's copy alive.
//
// What the rule still is, in Core and here: three independent facts — solved, no cell ever left on
// the wrong tone, no undo and no reset. The app pays one gem for each board and **one more when
// all three hold: "a perfect run"** (`Coins.PayoutAt`, `GameScreen.ResultLines`, the picker's "a
// board · +1 for a perfect run"). Hints are not in the rule. `isPerfect` is that sentence; the
// pages say "a perfect run" and never a number of stars.
export const MaxStars = 3;
export function rate(solved, everWrong, everWithdrew) {
    return !solved ? 0 : 1 + (everWrong ? 0 : 1) + (everWithdrew ? 0 : 1);
}
/**
 * A perfect run: solved, with no cell ever left on the wrong tone and no undo and no reset —
 * Core's three-star predicate (`Scoring.MaxStars`, the walk's `Perfect`), under the name the app
 * gives it. `everWithdrew` is "used Undo or Reset", counted the way the app counts it.
 */
export function isPerfect(solved, everWrong, everWithdrew) {
    return rate(solved, everWrong, everWithdrew) >= MaxStars;
}
//# sourceMappingURL=scoring.js.map
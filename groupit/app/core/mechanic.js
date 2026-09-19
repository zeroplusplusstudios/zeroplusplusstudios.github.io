// Ported from Assets/_Project/Scripts/Core/Model/Mechanic.cs
//
// APPEND-ONLY, exactly as the C# is. These values are written into the pack and into every
// chapter line and every share link, so a renumbering hands a shipped board somebody else's
// rules. Never reorder; never reuse a retired number.
/**
 * The one rule twist a board carries. Exactly one per puzzle — mechanics never compose,
 * which is what keeps every dispatch a single switch rather than a matrix.
 */
export var Mechanic;
(function (Mechanic) {
    Mechanic[Mechanic["None"] = 0] = "None";
    /** A third tone, Gold, joins the cycle. Region rules apply to it unchanged. */
    Mechanic[Mechanic["GoldHour"] = 1] = "GoldHour";
    /** Lantern clues: same-tone cells visible along four arms, self included. */
    Mechanic[Mechanic["LanternReach"] = 2] = "LanternReach";
    /** Walls cut edges between adjacent cells; regions cannot cross them. Arrows see over them. */
    Mechanic[Mechanic["GardenWalls"] = 3] = "GardenWalls";
    /** Law: all Shadow on the board forms a single connected piece. */
    Mechanic[Mechanic["OneSky"] = 4] = "OneSky";
    /** Tally clues in the gutters: exact Light counts per row and column. */
    Mechanic[Mechanic["Ledger"] = 5] = "Ledger";
    /** Open clues: region sizes printed with the tone withheld. */
    Mechanic[Mechanic["UnlitNumeral"] = 6] = "UnlitNumeral";
    /** Linked cell groups share one tone and flip together. */
    Mechanic[Mechanic["GasLine"] = 7] = "GasLine";
    /** Law: no 2x2 block may be a single tone. */
    Mechanic[Mechanic["NoFullCourtyard"] = 8] = "NoFullCourtyard";
    /** Law: in every column, Shadow sits above Light — night falls from the top. */
    Mechanic[Mechanic["Duskfall"] = 9] = "Duskfall";
    /** Law: every Light region must contain a Light region clue. */
    Mechanic[Mechanic["StrayLight"] = 10] = "StrayLight";
    /** Turnstile clues in the gutters: how many times a whole row or column turns tone. */
    Mechanic[Mechanic["Turnstile"] = 11] = "Turnstile";
    /** Law: no three cells in a row or column share a tone. */
    Mechanic[Mechanic["NeverThree"] = 12] = "NeverThree";
    /** Watch clues: how many of a cell's four neighbours are Light. Own tone withheld. */
    Mechanic[Mechanic["Watch"] = 13] = "Watch";
    /** Law: no 2x2 block holds exactly three Light — every lit patch is a solid rectangle. */
    Mechanic[Mechanic["Windowlight"] = 14] = "Windowlight";
    /** Law: within each tone, no two patches anywhere hold the same number of cells. */
    Mechanic[Mechanic["Rollcall"] = 15] = "Rollcall";
    /** Knight clues: same-tone cells a knight's move away. Own tone given. */
    Mechanic[Mechanic["LongStep"] = 16] = "LongStep";
    /** Cross clues: own tone down the row plus across the column, self counted once. */
    Mechanic[Mechanic["Crossroads"] = 17] = "Crossroads";
    /** Crest clues: the largest patch anywhere along the row or column the clue reads. */
    Mechanic[Mechanic["BigHouse"] = 18] = "BigHouse";
    /** Twin clues: two plaques wearing one letter stand in patches of equal, unprinted size. */
    Mechanic[Mechanic["LikeForLike"] = 19] = "LikeForLike";
    /** Shore clues: the perimeter of a patch rather than its area. Own tone given. */
    Mechanic[Mechanic["Shoreline"] = 20] = "Shoreline";
    /** Ordered cell pairs in Puzzle.pairs: tail Light implies head Light. */
    Mechanic[Mechanic["Weir"] = 21] = "Weir";
    /** Double clues: one number that is both the patch size and the ray's colour-change count. */
    Mechanic[Mechanic["TwiceTold"] = 22] = "TwiceTold";
    /** Law: no two Light patches share a normalised shape. Turned copies count as different. */
    Mechanic[Mechanic["Silhouette"] = 23] = "Silhouette";
    /** Law: no two Light cells sit a knight's move apart. Shadow is unconstrained. */
    Mechanic[Mechanic["NeverTheLongStep"] = 24] = "NeverTheLongStep";
    /** A Shadow region clue counts the patches touching it, not its own cells. */
    Mechanic[Mechanic["SecondReading"] = 25] = "SecondReading";
    /** Chevrons in Puzzle.pairs: heavy patch strictly larger than the light one. */
    Mechanic[Mechanic["Scales"] = 26] = "Scales";
    /** Law: two patches that share an edge never hold the same number of cells. */
    Mechanic[Mechanic["UnlikeNeighbours"] = 27] = "UnlikeNeighbours";
    /** Topology: column 0 and column cols-1 are adjacent. Regions wrap, rays do not. */
    Mechanic[Mechanic["Seam"] = 28] = "Seam";
    /** Void cells in Puzzle.voids: holes in the board that nothing crosses. */
    Mechanic[Mechanic["Well"] = 29] = "Well";
    /** Law: all Light on the board forms a single connected piece — OneSky with the tone swapped. */
    Mechanic[Mechanic["AllOneColour"] = 30] = "AllOneColour";
    /** Law: every row and every column holds exactly half Light, half Shadow. */
    Mechanic[Mechanic["EvenSplit"] = 31] = "EvenSplit";
})(Mechanic || (Mechanic = {}));
/** The highest mechanic id FromLine will accept. Mirrors the C# `> (int)Mechanic.EvenSplit`. */
export const MaxMechanic = Mechanic.EvenSplit;
//# sourceMappingURL=mechanic.js.map
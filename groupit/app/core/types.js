// Ported from Assets/_Project/Scripts/Core/Model/Types.cs
//
// A TRANSLITERATION, not a redesign. Names, numeric values and ordering match the C#
// exactly so the two can be diffed by eye and so the differential harness means something.
// Numeric values are load-bearing on both sides: they are serialised into the pack and into
// every share link, and a renumbering hands a shipped board somebody else's rules.
/**
 * The terminal colours of a solved board. Every cell is exactly one of these.
 * Shadow==0 / Light==1 lets the solver pack a row into a bitmask; Gold==2 exists only on
 * GoldHour boards.
 */
export var Tone;
(function (Tone) {
    Tone[Tone["Shadow"] = 0] = "Shadow";
    Tone[Tone["Light"] = 1] = "Light";
    Tone[Tone["Gold"] = 2] = "Gold";
})(Tone || (Tone = {}));
/**
 * What the *player* has committed to a cell. Distinct from Tone because a board in progress
 * has one more state than the solution does. Undo packs a move as (idx<<2)|mark, which holds
 * exactly four states.
 */
export var Mark;
(function (Mark) {
    Mark[Mark["Unknown"] = 0] = "Unknown";
    Mark[Mark["Shadow"] = 1] = "Shadow";
    Mark[Mark["Light"] = 2] = "Light";
    Mark[Mark["Gold"] = 3] = "Gold";
})(Mark || (Mark = {}));
/** Direction a line clue looks in, from its own cell to the board edge. */
export var Dir;
(function (Dir) {
    Dir[Dir["Right"] = 0] = "Right";
    Dir[Dir["Left"] = 1] = "Left";
    Dir[Dir["Up"] = 2] = "Up";
    Dir[Dir["Down"] = 3] = "Down";
})(Dir || (Dir = {}));
export var ClueKind;
(function (ClueKind) {
    /** "The region containing this cell is exactly N cells." Cell tone is given. */
    ClueKind[ClueKind["Region"] = 0] = "Region";
    /** "Looking this way, you cross K runs of colour." Cell tone is NOT given. */
    ClueKind[ClueKind["Line"] = 1] = "Line";
    /** "From here you can see N same-tone cells, counting this one, along all four arms." */
    ClueKind[ClueKind["Lantern"] = 2] = "Lantern";
    /** "This row (or column) holds exactly N Light cells." Lives off-grid. */
    ClueKind[ClueKind["Tally"] = 3] = "Tally";
    /** Region size with the tone WITHHELD. */
    ClueKind[ClueKind["Open"] = 4] = "Open";
    /** "This whole row (or column) changes tone exactly N times." Off-grid like Tally. */
    ClueKind[ClueKind["Turns"] = 5] = "Turns";
    /** "Exactly N of my four orthogonal neighbours are Light." Tone withheld. */
    ClueKind[ClueKind["Watch"] = 6] = "Watch";
    /** "Exactly N of the squares a knight's move from here wear my tone." Tone given. */
    ClueKind[ClueKind["Knight"] = 7] = "Knight";
    /** Own tone down the row plus across the column, self counted once. Tone given. */
    ClueKind[ClueKind["Cross"] = 8] = "Cross";
    /** The biggest patch touching the line I mark. Dir is Right or Down only. Tone given. */
    ClueKind[ClueKind["Crest"] = 9] = "Crest";
    /** A letter: Value is the letter INDEX; equal-sized patches share a letter. Tone withheld. */
    ClueKind[ClueKind["Twin"] = 10] = "Twin";
    /** The walk around my patch — its perimeter, not its area. Tone given. */
    ClueKind[ClueKind["Shore"] = 11] = "Shore";
    /** Patch size N AND the ray holds N+1 runs of colour. Tone withheld. */
    ClueKind[ClueKind["Double"] = 12] = "Double";
})(ClueKind || (ClueKind = {}));
export function toneToMark(t) {
    return t === Tone.Shadow ? Mark.Shadow : t === Tone.Light ? Mark.Light : Mark.Gold;
}
export function markIsTone(m) {
    return m !== Mark.Unknown;
}
/** Only meaningful when markIsTone; Unknown keeps its old Shadow bias. */
export function markToTone(m) {
    return m === Mark.Light ? Tone.Light : m === Mark.Gold ? Tone.Gold : Tone.Shadow;
}
//# sourceMappingURL=types.js.map
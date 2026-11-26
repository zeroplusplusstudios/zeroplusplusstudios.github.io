export var Tone;
(function (Tone) {
    Tone[Tone["Shadow"] = 0] = "Shadow";
    Tone[Tone["Light"] = 1] = "Light";
    Tone[Tone["Gold"] = 2] = "Gold";
})(Tone || (Tone = {}));
export var Mark;
(function (Mark) {
    Mark[Mark["Unknown"] = 0] = "Unknown";
    Mark[Mark["Shadow"] = 1] = "Shadow";
    Mark[Mark["Light"] = 2] = "Light";
    Mark[Mark["Gold"] = 3] = "Gold";
})(Mark || (Mark = {}));
export var Dir;
(function (Dir) {
    Dir[Dir["Right"] = 0] = "Right";
    Dir[Dir["Left"] = 1] = "Left";
    Dir[Dir["Up"] = 2] = "Up";
    Dir[Dir["Down"] = 3] = "Down";
})(Dir || (Dir = {}));
export var ClueKind;
(function (ClueKind) {
    ClueKind[ClueKind["Region"] = 0] = "Region";
    ClueKind[ClueKind["Line"] = 1] = "Line";
    ClueKind[ClueKind["Lantern"] = 2] = "Lantern";
    ClueKind[ClueKind["Tally"] = 3] = "Tally";
    ClueKind[ClueKind["Open"] = 4] = "Open";
    ClueKind[ClueKind["Turns"] = 5] = "Turns";
    ClueKind[ClueKind["Watch"] = 6] = "Watch";
    ClueKind[ClueKind["Knight"] = 7] = "Knight";
    ClueKind[ClueKind["Cross"] = 8] = "Cross";
    ClueKind[ClueKind["Crest"] = 9] = "Crest";
    ClueKind[ClueKind["Twin"] = 10] = "Twin";
    ClueKind[ClueKind["Shore"] = 11] = "Shore";
    ClueKind[ClueKind["Double"] = 12] = "Double";
})(ClueKind || (ClueKind = {}));
export function toneToMark(t) {
    return t === Tone.Shadow ? Mark.Shadow : t === Tone.Light ? Mark.Light : Mark.Gold;
}
export function markIsTone(m) {
    return m !== Mark.Unknown;
}
export function markToTone(m) {
    return m === Mark.Light ? Tone.Light : m === Mark.Gold ? Tone.Gold : Tone.Shadow;
}

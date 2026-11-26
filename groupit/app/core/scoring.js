export const MaxStars = 3;
export function rate(solved, everWrong, everWithdrew) {
    return !solved ? 0 : 1 + (everWrong ? 0 : 1) + (everWithdrew ? 0 : 1);
}
export function isPerfect(solved, everWrong, everWithdrew) {
    return rate(solved, everWrong, everWithdrew) >= MaxStars;
}

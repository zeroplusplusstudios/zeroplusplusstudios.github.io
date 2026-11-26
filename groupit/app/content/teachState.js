export const LessonKey = 'groupit.web.lesson';
export const RuleKeyPrefix = 'groupit.web.rule.';
function storage() {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    }
    catch {
        return null;
    }
}
function get(key) {
    try {
        return storage()?.getItem(key) ?? null;
    }
    catch {
        return null;
    }
}
function set(key, value) {
    try {
        storage()?.setItem(key, value);
    }
    catch { }
}
export function lessonDone() { return get(LessonKey) === 'done'; }
export function markLessonDone() { set(LessonKey, 'done'); }
export function ruleKey(mechanic) { return RuleKeyPrefix + String(mechanic); }
export function ruleSeen(mechanic) { return get(ruleKey(mechanic)) === '1'; }
export function markRuleSeen(mechanic) { set(ruleKey(mechanic), '1'); }

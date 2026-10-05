// The one line that switches web analytics on. It is EMPTY, and while it is empty the pages behave
// exactly as they did before analytics existed: no Google script is loaded, no request is made to
// anyone, nothing is written to the browser, no banner is drawn and no footer link is added.
// `test/analytics.ts` proves each of those against a recording environment, and fails the build if
// this ever changes without the rest of the checklist below.
//
// Added 2026-10-05 (round 35). The decision it serves: the app uses Google Analytics for Firebase
// from v1, and the web pages are one more data stream in the same GA4 property. That stream does
// not exist yet, which is why there is no id here.
//
// To switch it on, IN THIS ORDER (Web/README.md and Store/web-analytics-disclosure-draft.md carry
// the detail):
//
//   1. The owner approves the replacement privacy text, and the published privacy page is updated.
//      The page says today that the browser pages have no analytics; that sentence is false the
//      day this id is live. `test/analytics.ts` refuses a non-empty id while the draft still
//      carries its NOT YET PUBLISHED marker, or while Store/privacy-policy.md still says it.
//   2. The GA4 web stream is created and configured as the report describes (Enhanced
//      measurement OFF, Google signals OFF, data sharing OFF, retention 14 months).
//   3. Paste the stream's measurement id here (it looks like G-ABCDE12345), run `npm test` and
//      `npm run build`, check it in the browser with Realtime or DebugView, then deploy.
//
// A measurement id is not a secret: it is visible in every page's network traffic. It is checked
// against a strict pattern before it is ever put in a URL (src/ui/analytics.ts, validId).
export const MEASUREMENT_ID = '';
//# sourceMappingURL=analyticsConfig.js.map
export const AppStoreUrl = 'https://apps.apple.com/app/id6801780198';
export function playUrl(campaign) {
    return 'https://play.google.com/store/apps/details?id=com.zeroplusplus.groupit' +
        '&referrer=utm_source%3Dweb%26utm_medium%3Dbadge%26utm_campaign%3D' + campaign;
}
export function platformOf(userAgent, maxTouchPoints) {
    const ua = userAgent || '';
    if (/\b(iPhone|iPod|iPad)\b/.test(ua))
        return 'ios';
    if (/\bAndroid\b/i.test(ua))
        return 'android';
    if (/\bMacintosh\b/.test(ua) && maxTouchPoints > 1)
        return 'ios';
    return 'other';
}
export function storeFor(platform) {
    return platform === 'ios' ? 'app_store' : platform === 'android' ? 'google_play' : null;
}
export function visitorPlatform() {
    try {
        return platformOf(navigator.userAgent, navigator.maxTouchPoints || 0);
    }
    catch {
        return 'other';
    }
}
export function fitBadges(row, only, platform = visitorPlatform()) {
    const mine = storeFor(platform);
    if (mine === null)
        return;
    const badges = [...row.querySelectorAll('[data-store]')];
    for (const b of badges) {
        const isMine = b.getAttribute('data-store') === mine;
        if (only)
            b.hidden = !isMine;
        else if (isMine)
            row.prepend(b);
    }
}

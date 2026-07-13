// Frist zwischen Löschanfrage und endgültiger Löschung/Anonymisierung —
// meldet sich der Account vor Ablauf erneut an, wird er automatisch
// wiederhergestellt (siehe /api/account/restore).
export const ACCOUNT_DELETE_GRACE_DAYS = 30

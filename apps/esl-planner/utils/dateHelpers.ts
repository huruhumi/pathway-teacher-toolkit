export const isToday = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    return d.toDateString() === now.toDateString();
};

export const isThisWeek = (ts: number) => {
    const now = new Date();
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return ts >= weekAgo.getTime();
};

export const isThisMonth = (ts: number) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return ts >= monthStart.getTime();
};

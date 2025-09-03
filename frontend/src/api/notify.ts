export type Notifier = (message: string, severity?: 'success' | 'info' | 'warning' | 'error') => void;
let current: Notifier = () => {};
export const setNotifier = (fn: Notifier) => { current = fn; };
export const notify: Notifier = (message, severity = 'info') => current(message, severity);



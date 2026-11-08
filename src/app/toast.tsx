import { create } from 'zustand';

export interface ToastAction { label: string; fn: () => void }
interface Toast { id: number; msg: string; actions: ToastAction[] }
interface ToastState { list: Toast[]; push: (msg: string, actions?: ToastAction[], ms?: number) => void; remove: (id: number) => void }
let seq = 0;
export const useToasts = create<ToastState>((set, get) => ({
  list: [],
  push: (msg, actions = [], ms = 7000) => { const id = ++seq; set(s => ({ list: [...s.list, { id, msg, actions }].slice(-3) })); setTimeout(() => get().remove(id), ms); },
  remove: id => set(s => ({ list: s.list.filter(t => t.id !== id) })),
}));
export const toast = (msg: string, actions?: ToastAction[], ms?: number) => useToasts.getState().push(msg, actions, ms);

export function Toasts() {
  const { list, remove } = useToasts();
  return (
    <div className="toasts" aria-live="polite">
      {list.map(t => (
        <div className="toast" key={t.id}>
          <span>{t.msg}</span>
          {t.actions.map(a => <button key={a.label} type="button" onClick={() => { a.fn(); remove(t.id); }}>{a.label}</button>)}
        </div>
      ))}
    </div>
  );
}

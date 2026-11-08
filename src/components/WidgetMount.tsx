import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Widget } from '../app/widgets/Widget';

/** On the plain reading page, turns the static widget slots into live widgets. */
export default function WidgetMount() {
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.widget-slot').forEach(el => {
      if (el.dataset.mounted) return; el.dataset.mounted = '1';
      let props: Record<string, unknown> = {}; try { props = JSON.parse(el.dataset.props || '{}'); } catch { props = {}; }
      createRoot(el).render(<Widget name={el.dataset.widget || ''} props={props} />);
    });
  }, []);
  return null;
}

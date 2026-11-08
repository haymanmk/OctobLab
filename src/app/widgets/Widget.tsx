import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { registry } from './registry';
import '../../styles/widget.css';

class Boundary extends Component<{ children: ReactNode; name: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err: unknown) { console.error('widget failed', this.props.name, err); }
  render() { return this.state.failed ? <div className="widget widget-failed">The “{this.props.name}” demo could not start. The article text is unaffected.</div> : this.props.children; }
}

/** Mounts a registered widget and tells it whether it is on screen, so simulations pause when scrolled or panned away. */
export function Widget({ name, props }: { name: string; props: Record<string, unknown> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(es => setActive(es.some(e => e.isIntersecting)), { threshold: 0.05 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const C = registry[name];
  return (
    <div ref={ref} className="widget-host nodrag" data-widget={name}>
      {C ? (
        <Boundary name={name}>
          <Suspense fallback={<div className="widget widget-loading">Loading the demo…</div>}>
            <C props={props} active={active} />
          </Suspense>
        </Boundary>
      ) : <div className="widget widget-failed">Unknown widget “{name}”.</div>}
    </div>
  );
}

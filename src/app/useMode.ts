import { useEffect, useState } from 'react';
import type { LayoutMode } from './types';

/** desk: three panes · phone: tabs · square: an unfolded foldable or small tablet, board + reader · fold: two screens with a hinge */
export function useMode(simFold: boolean): LayoutMode {
  const [m, setM] = useState<LayoutMode>('desk');
  useEffect(() => {
    const qs = {
      phone: matchMedia('(max-width: 820px)'),
      square: matchMedia('(min-width: 640px) and (max-width: 1100px) and (min-aspect-ratio: 4/5) and (max-aspect-ratio: 5/4)'),
      foldH: matchMedia('(horizontal-viewport-segments: 2)'),
      foldV: matchMedia('(vertical-viewport-segments: 2)'),
    };
    const calc = () => setM(simFold || qs.foldH.matches || qs.foldV.matches ? 'fold' : qs.square.matches ? 'square' : qs.phone.matches ? 'phone' : 'desk');
    calc();
    Object.values(qs).forEach(q => q.addEventListener('change', calc));
    return () => Object.values(qs).forEach(q => q.removeEventListener('change', calc));
  }, [simFold]);
  return m;
}

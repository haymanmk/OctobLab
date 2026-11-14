import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface WidgetProps { props: Record<string, unknown>; active: boolean }
/** Name in a ```widget fence → React component. Loaded on demand so an article without widgets ships none of this code. */
export const registry: Record<string, LazyExoticComponent<ComponentType<WidgetProps>>> = {
  'ndob-sim': lazy(() => import('./NdobSim')),
  'ndob-design-sim': lazy(() => import('./NdobDesignSim')),
  'reverse-step': lazy(() => import('./ReverseStep')),
};

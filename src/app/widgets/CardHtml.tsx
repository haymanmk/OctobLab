import { useMemo } from 'react';
import parse, { Element, type HTMLReactParserOptions } from 'html-react-parser';
import { Widget } from './Widget';

/** Rendered card HTML from the build step, with widget slots swapped for live React widgets. */
export function CardHtml({ html }: { html: string }) {
  const options = useMemo<HTMLReactParserOptions>(() => ({
    replace: node => {
      if (node instanceof Element && node.attribs && /\bwidget-slot\b/.test(node.attribs.class || '')) {
        let props: Record<string, unknown> = {};
        try { props = JSON.parse(node.attribs['data-props'] || '{}'); } catch { props = {}; }
        return <Widget name={node.attribs['data-widget'] || 'unknown'} props={props} />;
      }
      return undefined;
    },
  }), []);
  return <>{parse(html, options)}</>;
}

import { useMemo } from 'react';
import parse, { Element, attributesToProps, domToReact, type DOMNode, type HTMLReactParserOptions } from 'html-react-parser';
import { Widget } from './Widget';
import { onContentLinkClick } from '../links';

/**
 * Rendered card HTML from the build step, with widget slots swapped for live React widgets.
 *
 * In-page links (`href="#heading"`) get their click handler here, on the link itself. A handler on the
 * surrounding card body or reader would make that whole container a tap target, and Chrome then snaps a
 * finger on the card's title to the body, so the title could no longer be dragged.
 *
 * The board can show one card twice (expanded on the board and open in the reader), so element ids are
 * turned into data-anchor: no duplicate ids, and the browser never scrolls the board to a fragment by itself.
 */
export function CardHtml({ html }: { html: string }) {
  const options = useMemo<HTMLReactParserOptions>(() => {
    const opts: HTMLReactParserOptions = {
      replace: node => {
        if (!(node instanceof Element) || !node.attribs) return undefined;
        if (/\bwidget-slot\b/.test(node.attribs.class || '')) {
          let props: Record<string, unknown> = {};
          try { props = JSON.parse(node.attribs['data-props'] || '{}'); } catch { props = {}; }
          return <Widget name={node.attribs['data-widget'] || 'unknown'} props={props} />;
        }
        if (node.attribs.id) { node.attribs['data-anchor'] = node.attribs.id; delete node.attribs.id; }
        if (node.name === 'a' && (node.attribs.href || '').startsWith('#')) {
          return (
            <a {...attributesToProps(node.attribs)} onClick={e => onContentLinkClick(e, e.currentTarget.closest<HTMLElement>('.reader-body, .card-body'))}>
              {domToReact(node.children as DOMNode[], opts)}
            </a>
          );
        }
        return undefined;
      },
    };
    return opts;
  }, []);
  return <>{parse(html, options)}</>;
}

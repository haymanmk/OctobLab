import type { InputMode } from '../types';
import { IconClose } from './icons';

/** The hints that used to sit under the board, shown on request and once on a reader's first visit. */
export const IconHelp = () => <svg viewBox="0 0 16 16" aria-hidden="true" className="help-ico"><path d="M5.6 6.1a2.4 2.4 0 1 1 3.5 2.1c-.7.4-1.1.9-1.1 1.7M8 13h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>;

/** `closing` keeps the box mounted while it shrinks back into the ? button; `onDone` unmounts it afterwards. */
export function HelpBox({ input, onClose, closing = false, onDone }: { input: InputMode; onClose: () => void; closing?: boolean; onDone?: () => void }) {
  const mouse = input === 'mouse';
  return (
    <div className={'helpbox' + (closing ? ' closing' : '')} role="dialog" aria-label="How to use the board" data-testid="helpbox" onAnimationEnd={e => { if (closing && e.animationName === 'help-out') onDone?.(); }}>
      <div className="help-head"><b>How to use the board</b><button type="button" className="iconbtn" onClick={onClose} aria-label="Close help" title="Close"><IconClose /></button></div>
      <ul>
        <li><b>{mouse ? 'Scroll' : 'Pinch'}</b> to zoom{mouse ? '.' : ', or ctrl + scroll on a trackpad.'}</li>
        <li><b>{mouse ? 'Hold the middle mouse button' : 'Drag the background'}</b> to pan{mouse ? ', from anywhere on the board.' : '.'}</li>
        <li><b>{mouse ? 'Drag a card' : 'Drag a card’s title'}</b> to move it. Cards you have not moved make room by themselves when one expands.</li>
        <li><b>Drag the dot</b> on a card’s right edge onto another card to connect them. {mouse ? 'Click' : 'Tap'} an arrow to hide it.</li>
        <li><b>The corner arrows</b> expand a card in place. <b>Read</b> opens it in the reader.</li>
        <li><b>Select text in the reader</b> to highlight it, then drag the highlight onto the board to make a note card.</li>
        <li>Your layout, highlights and notes stay in this browser. <b>Reset board</b> restores the author’s layout.</li>
      </ul>
      <div className="help-foot">{mouse ? 'On a touch screen? Switch to Touch in the toolbar.' : 'Using a mouse? Switch to Mouse in the toolbar.'}</div>
    </div>
  );
}

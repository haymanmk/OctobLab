import type { InputMode } from '../types';
import { IconClose } from './icons';

/** The hints that used to sit under the board, shown on request and once on a reader's first visit. */
export function HelpBox({ input, onClose }: { input: InputMode; onClose: () => void }) {
  const mouse = input === 'mouse';
  return (
    <div className="helpbox" role="dialog" aria-label="How to use the board" data-testid="helpbox">
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

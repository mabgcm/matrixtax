/**
 * The mobile menu is a native popover: opening and closing needs no script.
 * This module only:
 * - closes it after a link is chosen (needed for same-page anchors like /#faq),
 * - closes it when the viewport grows to the desktop layout,
 * - provides a small fallback for browsers without the Popover API (iOS 16 and
 *   older, which still have a meaningful share of mobile traffic).
 */
const menu = document.getElementById('mobile-menu');
const supportsPopover = 'showPopover' in HTMLElement.prototype;

if (menu) {
  const isOpen = () =>
    supportsPopover ? menu.matches(':popover-open') : menu.classList.contains('is-open');

  const close = () => {
    if (!isOpen()) return;
    if (supportsPopover) menu.hidePopover();
    else menu.classList.remove('is-open');
  };

  if (!supportsPopover) {
    document.addEventListener('click', (event) => {
      const trigger = (event.target as Element).closest('[popovertarget="mobile-menu"]');
      if (!trigger) return;
      const action = trigger.getAttribute('popovertargetaction');
      const open = action === 'hide' ? false : action === 'show' ? true : !isOpen();
      menu.classList.toggle('is-open', open);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }

  menu.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) close();
  });

  window.matchMedia('(min-width: 64rem)').addEventListener('change', (event) => {
    if (event.matches) close();
  });
}

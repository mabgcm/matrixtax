/**
 * The mobile menu is a native popover (no JS needed to open/close). This only
 * closes it after a link is chosen — needed for same-page anchors like /#faq —
 * and when the viewport grows to the desktop layout.
 */
const menu = document.getElementById('mobile-menu');

if (menu) {
  menu.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) menu.hidePopover();
  });

  const desktop = window.matchMedia('(min-width: 64rem)');
  desktop.addEventListener('change', (event) => {
    if (event.matches && menu.matches(':popover-open')) menu.hidePopover();
  });
}

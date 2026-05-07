/* Cross-document drawer-slide between the Teacher and Student catalogs.
   Direction is decided purely by destination:
     → going to students.html  = "forward" (drawer slides left-to-right)
     → going to index.html / root = "back" (drawer slides right-to-left)
   Browsers without View Transitions just snap-cut. */
(function () {
  if (!('startViewTransition' in document)) return;

  function isStudentsUrl(url) {
    return /students\.html(?:[?#]|$)/i.test(String(url || ''));
  }

  // Outgoing page: tag the transition based on where we're going.
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return;
    const destUrl = (e.activation && e.activation.entry && e.activation.entry.url) || '';
    e.viewTransition.types.add(isStudentsUrl(destUrl) ? 'forward' : 'back');
  });

  // Incoming page: tag based on where we landed.
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    e.viewTransition.types.add(isStudentsUrl(location.href) ? 'forward' : 'back');
  });
})();

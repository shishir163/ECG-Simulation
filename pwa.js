/* ECG Lab - offline support (service worker registration) */
(function () {
  if (!('serviceWorker' in navigator) || !/^https:|^http:\/\/localhost/.test(location.href)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            var b = document.createElement('button');
            b.textContent = 'Update available: tap to reload';
            b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:99;padding:10px 16px;border-radius:99px;border:0;background:var(--ac);color:var(--acInk);font:600 14px inherit;box-shadow:0 6px 20px rgba(0,0,0,.4)';
            b.onclick = function () { location.reload(); };
            document.body.appendChild(b);
          }
        });
      });
    }).catch(function () { /* offline support unavailable */ });
  });
})();

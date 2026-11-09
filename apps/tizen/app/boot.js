(function () {
  'use strict';
  function start() {
    var app = document.createElement('script'); app.src = 'app.js'; document.body.appendChild(app);
  }
  if (window.tizen) {
    document.body.classList.add('tv-device');
    var sdk = document.createElement('script'); sdk.src = '$WEBAPIS/webapis/webapis.js';
    sdk.onload = start; sdk.onerror = start; document.head.appendChild(sdk);
  } else start();
}());

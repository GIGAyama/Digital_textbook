/*
 * インストールの合図を「いちばん先に」受け取るためのファイル。
 *
 * Chrome は条件が揃うと即座に beforeinstallprompt を出す。React や
 * アプリ本体の読み込みより後で待ち構えていると、通信が遅い端末では
 * すでに合図が飛んだ後になってしまい、「アプリを入れる」ボタンが
 * 出なくなる。だから <head> のいちばん上で、この小さなファイルだけを
 * 先に読み込んで受け取っておく。
 *
 * インラインの <script> ではなく外部ファイルにしているのは、CSP を
 * script-src 'self' で締めるため（インラインを許すと CSP の意味が薄れる）。
 */
(function () {
  window.__deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__deferredInstallPrompt = e;
    window.dispatchEvent(new Event('pwa-installable'));
  });

  window.addEventListener('appinstalled', function () {
    window.__deferredInstallPrompt = null;
    window.dispatchEvent(new Event('pwa-installed'));
  });
})();

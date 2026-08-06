/* Nine Topology v2.8-test boot bridge
   Exposes the split classic-script API explicitly for Safari and runner_dev. */
(() => {
  'use strict';

  const publicFunctions = {
    initGame: typeof initGame === 'function' ? initGame : null,
    logMessage: typeof logMessage === 'function' ? logMessage : null,
    renderBoard: typeof renderBoard === 'function' ? renderBoard : null,
    toggleTestBot: typeof toggleTestBot === 'function' ? toggleTestBot : null,

    toggleWallDeclaration:
      typeof toggleWallDeclaration === 'function' ? toggleWallDeclaration : null,
    skipSlide: typeof skipSlide === 'function' ? skipSlide : null,
    undoOneMove: typeof undoOneMove === 'function' ? undoOneMove : null,
    downloadNtpnFile:
      typeof downloadNtpnFile === 'function' ? downloadNtpnFile : null,
    generateHighlightGIF:
      typeof generateHighlightGIF === 'function' ? generateHighlightGIF : null
  };

  const requiredNames = [
    'initGame',
    'logMessage',
    'renderBoard',
    'toggleTestBot'
  ];

  const missing = requiredNames.filter(name =>
    typeof publicFunctions[name] !== 'function'
  );

  function reportBootError(message) {
    window.__NINE_TOPOLOGY_READY__ = false;
    window.__NINE_TOPOLOGY_BOOT_ERROR__ = message;

    const logPanel = document.getElementById('log-panel');
    if (logPanel) {
      logPanel.textContent = `[BOOT ERROR] ${message}`;
      logPanel.style.color = '#ff6b8a';
    }

    console.error(`[Nine Topology boot] ${message}`);
  }

  if (missing.length > 0) {
    reportBootError(`Missing module API: ${missing.join(', ')}`);
    return;
  }

  for (const [name, value] of Object.entries(publicFunctions)) {
    if (typeof value === 'function') {
      window[name] = value;
    }
  }

  window.__NINE_TOPOLOGY_BOOT_ERROR__ = '';
  window.__NINE_TOPOLOGY_READY__ = true;

  const start = () => {
    try {
      window.initGame();
    } catch (error) {
      reportBootError(error && error.message ? error.message : String(error));
    }
  };

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
  }
})();

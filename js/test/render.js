/* Nine Topology v2.8-test: board rendering override
   Loaded after the shared v2.7.2 module and replaces only rule-dependent functions. */

function renderBoard() {
    const container = document.getElementById('board-container');
    container.innerHTML = '';

    for (let b = 0; b < 9; b++) {
      const blockEl = document.createElement('div');
      blockEl.className = 'block';

      if (slideLockedBlocks.includes(b)) blockEl.classList.add('locked');

      for (let c = 0; c < 9; c++) {
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        if ((gamePhase === 'setup' || gamePhase === 'place') && isValidPlaceTarget(b, c)) {
          cellEl.classList.add('manual-target');
          cellEl.onclick = () => handleCellClick(b, c);
        }

        const stoneType = board[b][c];
        if (stoneType) {
          const stoneEl = document.createElement('div');
          stoneEl.className = `stone ${stoneType}`;
          if ((stoneType === 'white' || stoneType === 'black') && gasProtectedBoard[b][c]) {
            stoneEl.classList.add('gas-shielded');
          }
          cellEl.appendChild(stoneEl);
        }

        blockEl.appendChild(cellEl);
      }

      if (gamePhase === 'slide' && !testBot.intervalId && !slideLockedBlocks.includes(b)) {
        const pad = document.createElement('div');
        pad.className = 'slide-pad';
        const arrows = [
          ['up', '↑', 'slide-up'], ['down', '↓', 'slide-down'],
          ['left', '←', 'slide-left'], ['right', '→', 'slide-right']
        ];
        arrows.forEach(([dir, label, cls]) => {
          const btn = document.createElement('button');
          btn.className = `slide-arrow ${cls}`;
          btn.textContent = label;
          btn.onclick = (ev) => { ev.stopPropagation(); executeSlide(b, dir); };
          pad.appendChild(btn);
        });
        blockEl.appendChild(pad);
      }

      container.appendChild(blockEl);
    }
    const skipBtn = document.getElementById('btn-skip-slide');
    if (skipBtn) skipBtn.disabled = gamePhase !== 'slide';
    updateStatusPanel();
  }

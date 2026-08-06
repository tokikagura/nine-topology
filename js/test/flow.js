/* Nine Topology v2.8-test: Blue event, Gas, status, and slide overrides
   Loaded after the shared v2.7.2 module and replaces only rule-dependent functions. */

function checkBlueStoneDrop() {
    if (gamePhase !== 'place') return;

    for (const event of BLUE_DROP_EVENTS) {
      if (event.initial || blueDropState[event.id] || turnNumber !== event.turn) continue;

      // 青石の降臨座標はブロックスライドの影響を受けない固定座標。
      const reservedCell = event.cell;
      if (board[event.block][reservedCell] !== 'blue-reserved') {
        logMessage(`【青石降臨エラー】固定座標 ${event.id}-${CELL_NAMES[reservedCell]} に予約マーカーがありません。`);
        continue;
      }

      board[event.block][reservedCell] = 'blue';
      blueDropState[event.id] = true;
      const dropCellName = CELL_NAMES[reservedCell];
      appendTurnEvent(`[EVENT:BLUE_DROP ${event.id}-${dropCellName} turn=${turnNumber}]`);
      logMessage(`【青石降臨】ターン${turnNumber}、青石が ${event.id}-${dropCellName} に出現。確保しても得点はなく、ガス保護枠5を得ます。`);

      // すでに完全包囲されていれば、降臨直後に手番側が確保する。
      const grid = get9x9Grid(board);
      const globalR = Math.floor(event.block / 3) * 3 + Math.floor(reservedCell / 3);
      const globalC = (event.block % 3) * 3 + (reservedCell % 3);
      const res = getGroupLiberties(grid, globalR, globalC);
      if (res.liberties === 0) {
        res.group.forEach(pos => { grid[pos.r][pos.c] = null; });
        set9x9GridToBoard(grid, board);
        secureBlueStones(currentPlayer, res.group.length, '降臨時包囲');
        appendTurnEvent(`[EVENT:BLUE_SECURED owner=${currentPlayer} count=${res.group.length}]`);
      }
    }
  }

function chooseGasProtectedTargets(grid, targets, color, limit) {
    if (limit <= 0) return [];
    const targetKeys = new Set(
      [...targets.values()]
        .filter(t => t.from === color && !isGasProtectedAt(t.r, t.c))
        .map(t => `${t.r},${t.c}`)
    );
    if (targetKeys.size === 0) return [];

    const checked = Array.from({length: 9}, () => Array(9).fill(false));
    const damagedGroups = [];

    for (const key of targetKeys) {
      const [r, c] = key.split(',').map(Number);
      if (checked[r][c]) continue;
      const group = getGroupLiberties(grid, r, c).group;
      group.forEach(pos => { checked[pos.r][pos.c] = true; });
      const threatened = group.filter(pos => targetKeys.has(`${pos.r},${pos.c}`));
      damagedGroups.push({
        groupSize: group.length,
        threatened,
        firstKey: threatened.map(pos => `${String(pos.r).padStart(2,'0')},${String(pos.c).padStart(2,'0')}`).sort()[0]
      });
    }

    damagedGroups.sort((a, b) =>
      b.threatened.length - a.threatened.length ||
      b.groupSize - a.groupSize ||
      a.firstKey.localeCompare(b.firstKey)
    );

    const protectedTargets = [];
    for (const group of damagedGroups) {
      const ordered = [...group.threatened].sort((a, b) => a.r - b.r || a.c - b.c);
      for (const pos of ordered) {
        if (protectedTargets.length >= limit) return protectedTargets;
        protectedTargets.push(pos);
      }
    }
    return protectedTargets;
  }

function processEndOfTurnGas() {
    emptyCount = countEmptyCells();

    if (!gasPhaseActive && emptyCount <= 10) {
      gasPhaseActive = true;
      logMessage(`【ガスフェーズ開始】空き${emptyCount}。青石保護枠を適用後、空きマス周辺の通常石が中立化します。`);
      appendTurnEvent(`[EVENT:GAS_START empty=${emptyCount}]`);
    }

    if (!gasPhaseActive) return 0;

    const grid = get9x9Grid(board);
    const targets = new Map();
    const dr = [-1, 1, 0, 0];
    const dc = [0, 0, -1, 1];

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] !== null) continue;
        for (let i = 0; i < 4; i++) {
          const nr = r + dr[i];
          const nc = c + dc[i];
          if (nr < 0 || nr >= 9 || nc < 0 || nc >= 9) continue;
          if (grid[nr][nc] === 'white' || grid[nr][nc] === 'black') {
            targets.set(`${nr},${nc}`, { r: nr, c: nc, from: grid[nr][nc] });
          }
        }
      }
    }

    if (targets.size === 0) return 0;

    const protectedKeys = new Set();
    for (const [key, target] of targets.entries()) {
      if (isGasProtectedAt(target.r, target.c)) protectedKeys.add(key);
    }

    for (const color of ['white', 'black']) {
      const protectedList = chooseGasProtectedTargets(
        grid,
        targets,
        color,
        blueProtectionRemaining[color]
      );
      if (protectedList.length > 0) {
        protectedList.forEach(pos => {
          protectedKeys.add(`${pos.r},${pos.c}`);
          setGasProtectedAt(pos.r, pos.c, true);
        });
        blueProtectionRemaining[color] -= protectedList.length;
        const labels = protectedList.map(coordLabel).join(',');
        appendTurnEvent(`[EVENT:BLUE_PROTECT owner=${color} count=${protectedList.length} cells=${labels}]`);
        logMessage(`【青石保護】${color === 'white' ? '白' : '黒'}の${protectedList.length}石を恒久防御。ガス免疫として盤面移動にも追従。保護残り${blueProtectionRemaining[color]}。`);
      }
    }

    const changed = [];
    for (const [key, target] of targets.entries()) {
      if (protectedKeys.has(key)) continue;
      setGasProtectedAt(target.r, target.c, false);
      grid[target.r][target.c] = 'neutral';
      changed.push(`${coordLabel(target)}:${target.from === 'white' ? 'W' : 'B'}>N`);
    }

    set9x9GridToBoard(grid, board);
    emptyCount = countEmptyCells();
    if (changed.length > 0) {
      appendTurnEvent(`[EVENT:GAS_NEUTRALIZE ${changed.join(',')}]`);
    }
    logMessage(`【ガス処理】対象${targets.size}石 / 保護${protectedKeys.size}石 / 中立化${changed.length}石。得点加算・空き増加なし。`);
    return changed.length;
  }

function updateStatusPanel() {
    emptyCount = countEmptyCells();

    const isCurrentStarter = currentPlayer === startingPlayer;
    document.getElementById('current-player').innerText = `${isCurrentStarter ? '先手' : '後手'} (${currentPlayer === 'white' ? '白' : '黒'})`;
    const whiteRole = startingPlayer === 'white' ? '先手' : '後手';
    const blackRole = startingPlayer === 'black' ? '先手' : '後手';
    const whiteRoleLabel = document.getElementById('white-role-label');
    const blackRoleLabel = document.getElementById('black-role-label');
    if (whiteRoleLabel) whiteRoleLabel.innerText = `白 (${whiteRole}):`;
    if (blackRoleLabel) blackRoleLabel.innerText = `黒 (${blackRole}):`;
    document.getElementById('turn-count').innerText = turnNumber;
    document.getElementById('empty-count').innerText = emptyCount;
    document.getElementById('score-p1').innerText = `${playerScores.white} pt`;
    document.getElementById('score-p2').innerText = `${playerScores.black} pt`;
    document.getElementById('wall-p1').innerText = wallCount.white;
    document.getElementById('wall-p2').innerText = wallCount.black;
    document.getElementById('blue-shield-p1').innerText = blueProtectionRemaining.white;
    document.getElementById('blue-shield-p2').innerText = blueProtectionRemaining.black;
    updateUndoButton();

    const lockStatusEl = document.getElementById('slide-lock-status');
    const instructionEl = document.getElementById('phase-instruction');

    if (gamePhase === 'setup') {
      lockStatusEl.innerText = "準備フェーズ";
      instructionEl.innerText = "【準備フェーズ】四隅ブロックに各自初期石をデポジット中...";
    } else if (gamePhase === 'place') {
      if (gasPhaseActive) lockStatusEl.innerText = `ガスフェーズ (空き${emptyCount})`;
      else if (emptyCount <= 15) lockStatusEl.innerText = `終盤警告 (空き${emptyCount})`;
      else lockStatusEl.innerText = "スライド可能";
      instructionEl.innerText = "【配置フェーズ】石を配置して呼吸点を包囲してください";
    } else if (gamePhase === 'slide') {
      lockStatusEl.innerText = "スライド選択待ち";
      instructionEl.innerText = "【スライドフェーズ】ブロックのスライド移動を実行中...";
    }
  }

function restoreFixedBlueReservations() {
    for (const event of BLUE_DROP_EVENTS) {
      if (event.initial || blueDropState[event.id]) continue;

      const block = board[event.block];
      const fixedCell = event.cell;
      const movedCell = block.findIndex(cell => cell === 'blue-reserved');

      if (movedCell === fixedCell) continue;

      if (movedCell >= 0) {
        // スライドで動いた予約マーカーと固定座標の内容を交換する。
        const displaced = block[fixedCell];
        block[fixedCell] = 'blue-reserved';
        block[movedCell] = displaced;
      } else {
        // 万一マーカーが失われても、固定座標へ復元する。
        block[fixedCell] = 'blue-reserved';
      }
    }
  }

function executeSlide(b, direction) {
    if (gamePhase !== 'slide' || slideLockedBlocks.includes(b)) return;
    const block = board[b];
    const shieldBlock = gasProtectedBoard[b];

    if (direction === 'right') {
      let t0 = block[2]; block[2] = block[1]; block[1] = block[0]; block[0] = t0;
      let t1 = block[5]; block[5] = block[4]; block[4] = block[3]; block[3] = t1;
      let t2 = block[8]; block[8] = block[7]; block[7] = block[6]; block[6] = t2;
      let s0 = shieldBlock[2]; shieldBlock[2] = shieldBlock[1]; shieldBlock[1] = shieldBlock[0]; shieldBlock[0] = s0;
      let s1 = shieldBlock[5]; shieldBlock[5] = shieldBlock[4]; shieldBlock[4] = shieldBlock[3]; shieldBlock[3] = s1;
      let s2 = shieldBlock[8]; shieldBlock[8] = shieldBlock[7]; shieldBlock[7] = shieldBlock[6]; shieldBlock[6] = s2;
      currentTurnMove.slide = `>B${b+1}-R`;
    } else if (direction === 'left') {
      let t0 = block[0]; block[0] = block[1]; block[1] = block[2]; block[2] = t0;
      let t1 = block[3]; block[3] = block[4]; block[4] = block[5]; block[5] = t1;
      let t2 = block[6]; block[6] = block[7]; block[7] = block[8]; block[8] = t2;
      let s0 = shieldBlock[0]; shieldBlock[0] = shieldBlock[1]; shieldBlock[1] = shieldBlock[2]; shieldBlock[2] = s0;
      let s1 = shieldBlock[3]; shieldBlock[3] = shieldBlock[4]; shieldBlock[4] = shieldBlock[5]; shieldBlock[5] = s1;
      let s2 = shieldBlock[6]; shieldBlock[6] = shieldBlock[7]; shieldBlock[7] = shieldBlock[8]; shieldBlock[8] = s2;
      currentTurnMove.slide = `>B${b+1}-L`;
    } else if (direction === 'down') {
      let t0 = block[6]; block[6] = block[3]; block[3] = block[0]; block[0] = t0;
      let t1 = block[7]; block[7] = block[4]; block[4] = block[1]; block[1] = t1;
      let t2 = block[8]; block[8] = block[5]; block[5] = block[2]; block[2] = t2;
      let s0 = shieldBlock[6]; shieldBlock[6] = shieldBlock[3]; shieldBlock[3] = shieldBlock[0]; shieldBlock[0] = s0;
      let s1 = shieldBlock[7]; shieldBlock[7] = shieldBlock[4]; shieldBlock[4] = shieldBlock[1]; shieldBlock[1] = s1;
      let s2 = shieldBlock[8]; shieldBlock[8] = shieldBlock[5]; shieldBlock[5] = shieldBlock[2]; shieldBlock[2] = s2;
      currentTurnMove.slide = `>B${b+1}-D`;
    } else if (direction === 'up') {
      let t0 = block[0]; block[0] = block[3]; block[3] = block[6]; block[6] = t0;
      let t1 = block[1]; block[1] = block[4]; block[4] = block[7]; block[7] = t1;
      let t2 = block[2]; block[2] = block[5]; block[5] = block[8]; block[8] = t2;
      let s0 = shieldBlock[0]; shieldBlock[0] = shieldBlock[3]; shieldBlock[3] = shieldBlock[6]; shieldBlock[6] = s0;
      let s1 = shieldBlock[1]; shieldBlock[1] = shieldBlock[4]; shieldBlock[4] = shieldBlock[7]; shieldBlock[7] = s1;
      let s2 = shieldBlock[2]; shieldBlock[2] = shieldBlock[5]; shieldBlock[5] = shieldBlock[8]; shieldBlock[8] = s2;
      currentTurnMove.slide = `>B${b+1}-U`;
    }

    // 未降臨の青石予約マスは盤面座標に固定し、スライドでは移動させない。
    restoreFixedBlueReservations();

    diagnosticContext = `${testBot.intervalId ? 'BOT' : 'MANUAL'}_SLIDE B${b+1}-${direction.toUpperCase()}`;
    let grid = get9x9Grid(board);
    resolveAllCapturesSimultaneously(grid, currentPlayer, false);
    set9x9GridToBoard(grid, board);
    emptyCount = countEmptyCells();

    if (gamePhase === 'gameover') {
      commitTurnMove();
      renderBoard();
      return true;
    }

    processEndOfTurnGas();
    if (commitTurnMove()) return true;
    slideLockedBlocks = [];
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    gamePhase = 'place';
    processRedReservations();
    checkBlueStoneDrop();
    renderBoard();
    return true;
  }

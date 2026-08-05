  function logMessage(msg) {
    const logPanel = document.getElementById('log-panel');
    if (!logPanel) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    logPanel.innerHTML += `[${time}] ${msg}<br>`;
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  function checkBlueStoneDrop() {
    if (blueStoneDropped || turnNumber !== SEASON_DROP_TURN || gamePhase !== 'place') return;

    // v2.5e: B3をスライドすると予約マーカーも移動するため、
    // 固定のb2ではなくB3内の現在位置を検索して実体化する。
    const reservedCell = board[2].findIndex(cell => cell === 'blue-reserved');
    if (reservedCell === -1) {
      logMessage('【青石降臨エラー】B3内に予約マーカーが見つからないため降臨を停止しました。');
      return;
    }

    board[2][reservedCell] = 'blue';
    blueStoneDropped = true;
    const dropCellName = CELL_NAMES[reservedCell];
    appendTurnEvent(`[EVENT:BLUE_DROP B3-${dropCellName}]`);
    logMessage(`【シーズン環境イベント】青石が B3-${dropCellName} にドロップ降臨いたしました！`);
  }

  function commitTurnMove() {
    if (!currentTurnMove.place) return;

    const pSide = currentPlayer === 'white' ? 'W' : 'B';
    const placeStr = `${pSide}${currentTurnMove.place}`;
    const slideStr = currentTurnMove.slide ? `${pSide}${currentTurnMove.slide}` : `${pSide}>PASS`;
    const eventPrefix = currentTurnMove.event ? `${currentTurnMove.event} ` : '';

    const fullMoveStr = `${eventPrefix}${placeStr} / ${slideStr}`;
    ntpnMoveHistory.push(`${turnNumber}. ${fullMoveStr}`);

    logMessage(`[記譜] ${turnNumber}. ${fullMoveStr}`);
    saveBoardSnapshot();

    // v2.5f: 128手目を記録した直後、その場で得点判定して完全停止する。
    // 15個捕獲ですでに終局している場合は、そちらの結果を優先する。
    if (gamePhase !== 'gameover' && turnNumber >= MAX_TURNS) {
      currentTurnMove = { place: null, slide: null, event: null };
      finishByTurnLimit();
      return true;
    }

    turnNumber++;
    currentTurnMove = { place: null, slide: null, event: null };
    return false;
  }

  function countEmptyCells() {
    let count = 0;
    for (let b = 0; b < 9; b++) for (let c = 0; c < 9; c++) if (board[b][c] === null) count++;
    return count;
  }


  function appendTurnEvent(eventText) {
    currentTurnMove.event = currentTurnMove.event
      ? `${currentTurnMove.event} ${eventText}`
      : eventText;
  }

  // v2.5.3: 空き10以下でガスフェーズ開始。
  // その手の終了時点に存在する空きマスを発生源として、上下左右の白石・黒石を
  // 同時に中立石へ変換する。得点・空きマス化・連鎖は発生しない。
  function processEndOfTurnGas() {
    emptyCount = countEmptyCells();

    if (!gasPhaseActive && emptyCount <= 10) {
      gasPhaseActive = true;
      logMessage(`【ガスフェーズ開始】空き${emptyCount}。空きマス周辺の通常石が中立化します。`);
      appendTurnEvent(`[EVENT:GAS_START empty=${emptyCount}]`);
    }

    if (!gasPhaseActive) return 0;

    const grid = get9x9Grid(board);
    const targets = new Map();
    const dr = [-1, 1, 0, 0];
    const dc = [0, 0, -1, 1];

    // 変換前の盤面だけを参照して対象を確定するため、この処理内では連鎖しない。
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

    const changed = [];
    for (const target of targets.values()) {
      grid[target.r][target.c] = 'neutral';
      changed.push(`${coordLabel(target)}:${target.from === 'white' ? 'W' : 'B'}>N`);
    }

    set9x9GridToBoard(grid, board);
    emptyCount = countEmptyCells();
    appendTurnEvent(`[EVENT:GAS_NEUTRALIZE ${changed.join(',')}]`);
    logMessage(`【ガス中立化】${targets.size}個の石が中立石へ変化。得点加算・空き増加なし。`);
    return targets.size;
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

  function isValidPlaceTarget(b, c) {
    if (board[b][c] !== null) return false;
    if (gamePhase === 'setup') {
      if (!CORNER_BLOCKS.includes(b)) return false;
      if (board[b].some(stone => stone === currentPlayer)) return false;
      return true;
    } else if (gamePhase === 'place') {
      if (isSuicideMove(b, c, currentPlayer)) return false;
      if (isKoRepeatMove(b, c, currentPlayer)) return false;
      return true;
    }
    return false;
  }

  function handleCellClick(b, c) {
    if (gamePhase === 'setup') {
      if (!isValidPlaceTarget(b, c)) return;
      saveUndoState();
      board[b][c] = currentPlayer;
      setupCount++;
      if (setupCount === 4) {
        gamePhase = 'place';
        processRedReservations();
        checkBlueStoneDrop();
      }
      currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
      renderBoard();
    } else if (gamePhase === 'place') {
      if (!isValidPlaceTarget(b, c)) return;
      saveUndoState();

      const cellCoord = CELL_NAMES[c];
      if (isWallDeclarationActive && wallCount[currentPlayer] > 0) {
        // 赤石（絶対障壁）のシークレット申告 (2ターン後出現: +2ターン)
        wallCount[currentPlayer]--;
        isWallDeclarationActive = false;
        const btn = document.getElementById('btn-wall-declare');
        if (btn) { btn.style.outline = "none"; btn.innerText = "赤石 (絶対障壁) をセット申告"; }

        redReservations.push({ b, c, dueTurn: turnNumber + 2, player: currentPlayer });
        currentTurnMove.place = `+B${b+1}-${cellCoord}(SECRET_RED)`;
        appendTurnEvent(`[EVENT:RED_DECLARE B${b+1}-${cellCoord} due=${turnNumber + 2}]`);
        logMessage(`【シークレット申告】${currentPlayer === 'white' ? '白' : '黒'}が赤石障壁の出現場所を暗黙予約しました。`);
      } else {
        board[b][c] = currentPlayer;
        currentTurnMove.place = `+B${b+1}-${cellCoord}`;
      }

      diagnosticContext = `${testBot.intervalId ? 'BOT' : 'MANUAL'}_PLACE B${b+1}-${cellCoord}`;
      let grid = get9x9Grid(board);
      let capturedCount = processCaptures(grid, currentPlayer);
      set9x9GridToBoard(grid, board);

      emptyCount = countEmptyCells();

      if (gamePhase === 'gameover') {
        commitTurnMove();
        renderBoard();
        return;
      }

      if (capturedCount > 0) {
        logMessage(`【即時ターン確定】配置により捕獲が発生したためスライドをスキップします。`);
        currentTurnMove.slide = null;
        processEndOfTurnGas();
        if (commitTurnMove()) return;
        currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
        gamePhase = 'place';
        processRedReservations();
        checkBlueStoneDrop();
      } else {
        gamePhase = 'slide';
      }
      renderBoard();
    }
  }

  function executeSlide(b, direction) {
    if (gamePhase !== 'slide' || slideLockedBlocks.includes(b)) return;
    const block = board[b];

    if (direction === 'right') {
      let t0 = block[2]; block[2] = block[1]; block[1] = block[0]; block[0] = t0;
      let t1 = block[5]; block[5] = block[4]; block[4] = block[3]; block[3] = t1;
      let t2 = block[8]; block[8] = block[7]; block[7] = block[6]; block[6] = t2;
      currentTurnMove.slide = `>B${b+1}-R`;
    } else if (direction === 'left') {
      let t0 = block[0]; block[0] = block[1]; block[1] = block[2]; block[2] = t0;
      let t1 = block[3]; block[3] = block[4]; block[4] = block[5]; block[5] = t1;
      let t2 = block[6]; block[6] = block[7]; block[7] = block[8]; block[8] = t2;
      currentTurnMove.slide = `>B${b+1}-L`;
    } else if (direction === 'down') {
      let t0 = block[6]; block[6] = block[3]; block[3] = block[0]; block[0] = t0;
      let t1 = block[7]; block[7] = block[4]; block[4] = block[1]; block[1] = t1;
      let t2 = block[8]; block[8] = block[5]; block[5] = block[2]; block[2] = t2;
      currentTurnMove.slide = `>B${b+1}-D`;
    } else if (direction === 'up') {
      let t0 = block[0]; block[0] = block[3]; block[3] = block[6]; block[6] = t0;
      let t1 = block[1]; block[1] = block[4]; block[4] = block[7]; block[7] = t1;
      let t2 = block[2]; block[2] = block[5]; block[5] = block[8]; block[8] = t2;
      currentTurnMove.slide = `>B${b+1}-U`;
    }

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

  function skipSlide() {
    if (gamePhase !== 'slide') return;
    currentTurnMove.slide = null;
    processEndOfTurnGas();
    if (commitTurnMove()) return;
    slideLockedBlocks = [];
    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
    gamePhase = 'place';
    processRedReservations();
    checkBlueStoneDrop();
    renderBoard();
  }

  function initGame() {
    board = Array.from({length: 9}, () => Array(9).fill(null));
    emptyCount = 81;
    wallCount = { white: 5, black: 5 };
    playerScores = { white: 0, black: 0 };
    slideLockedBlocks = [];
    currentPlayer = startingPlayer;
    gamePhase = 'setup';
    setupCount = 0;
    isWallDeclarationActive = false;
    redReservations = [];

    blueDropState = { B1: true, B9: false, B5: false };
    blueProtectionRemaining = { white: 0, black: 0 };
    blueStonesSecured = { white: 0, black: 0 };
    gasProtectedBoard = Array.from({length: 9}, () => Array(9).fill(false));
    gasPhaseActive = false;
    gameEndInfo = {
      winner: 'IN_PROGRESS',
      reason: 'IN_PROGRESS',
      turns: null,
      detail: ''
    };
    // 青石はB1-c3から開始し、B9-a1・B5-b2へ順次降臨。
    board[0][8] = 'blue';          // B1-c3: 初期青石
    board[8][0] = 'blue-reserved'; // B9-a1: 12ターン目
    board[4][4] = 'blue-reserved'; // B5-b2: 50ターン目

    ntpnMoveHistory = [];
    boardSnapshots = [];
    undoHistory = [];
    saveBoardSnapshot();

    currentTurnMove = { place: null, slide: null, event: null };
    turnNumber = 1;

    const logPanel = document.getElementById('log-panel');
    if (logPanel) logPanel.innerHTML = '';

    logMessage('システム起動 v2.8-test。青石は0点、確保1個につきガス被害を最大5石防御。B1-c3初期・B9-a1=12T・B5-b2=50T。');
    renderBoard();
  }

  function toggleWallDeclaration() {
    if (gamePhase !== 'place') return;
    if (wallCount[currentPlayer] <= 0) {
      logMessage(`【警告】${currentPlayer === 'white' ? '白' : '黒'}の赤石ストックがありません。`);
      return;
    }
    isWallDeclarationActive = !isWallDeclarationActive;
    const btn = document.getElementById('btn-wall-declare');
    if (isWallDeclarationActive) {
      btn.style.outline = "2px solid #66fcf1";
      btn.innerText = "【選択中】置きたいマスをクリック (申告)";
    } else {
      btn.style.outline = "none";
      btn.innerText = "赤石 (絶対障壁) をセット申告";
    }
  }

  /* 赤石出現のタイマー処理 (2ターン後手番時) */
  function processRedReservations() {
    let remaining = [];
    for (let res of redReservations) {
      if (res.dueTurn === turnNumber) {
        if (board[res.b][res.c] === null || board[res.b][res.c] === 'blue-reserved') {
          board[res.b][res.c] = 'red';
          appendTurnEvent(`[EVENT:RED_APPEAR B${res.b+1}-${CELL_NAMES[res.c]} owner=${res.player === 'white' ? 'W' : 'B'}]`);
          logMessage(`【環境イベント】${res.player === 'white' ? '白' : '黒'}が申告した【赤石（絶対障壁）】が B${res.b+1}-${CELL_NAMES[res.c]} に出現！`);
          // 出現による呼吸点遮断・捕獲チェック（同一盤面から同時判定）
          diagnosticContext = `RED_APPEAR B${res.b+1}-${CELL_NAMES[res.c]} owner=${res.player}`;
          let grid = get9x9Grid(board);
          resolveAllCapturesSimultaneously(grid, res.player, false);
          set9x9GridToBoard(grid, board);
          emptyCount = countEmptyCells();
          if (gamePhase === 'gameover') break;
        } else {
          appendTurnEvent(`[EVENT:RED_FAIL B${res.b+1}-${CELL_NAMES[res.c]} owner=${res.player === 'white' ? 'W' : 'B'}]`);
          logMessage(`【不渡り】${res.player === 'white' ? '白' : '黒'}が申告した赤石の出現位置が埋まっていたため設置失敗。`);
        }
      } else {
        remaining.push(res);
      }
    }
    redReservations = remaining;
  }

  function get9x9Grid(boardData) {
    let grid = Array.from({length: 9}, () => Array(9).fill(null));
    for (let b = 0; b < 9; b++) {
      for (let c = 0; c < 9; c++) {
        let r = Math.floor(b / 3) * 3 + Math.floor(c / 3);
        let col = (b % 3) * 3 + (c % 3);
        grid[r][col] = boardData[b][c];
      }
    }
    return grid;
  }

  function set9x9GridToBoard(grid, boardData) {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        let b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        let cell = (r % 3) * 3 + (c % 3);
        boardData[b][cell] = grid[r][c];
      }
    }
  }

  function getGroupLiberties(grid, startR, startC) {
    const targetType = grid[startR][startC];
    if (!targetType || targetType === 'red' || targetType === 'blue-reserved') {
      return { group: [], liberties: 99 };
    }

    let group = [];
    let liberties = new Set();
    let visited = Array.from({length: 9}, () => Array(9).fill(false));
    let queue = [[startR, startC]];
    visited[startR][startC] = true;

    const dr = [-1, 1, 0, 0];
    const dc = [0, 0, -1, 1];

    while (queue.length > 0) {
      let [r, c] = queue.shift();
      group.push({ r, c });

      for (let i = 0; i < 4; i++) {
        let nr = r + dr[i];
        let nc = c + dc[i];

        if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
          let neighbor = grid[nr][nc];
          if (neighbor === null) {
            liberties.add(`${nr},${nc}`);
          } else if (neighbor === targetType && !visited[nr][nc]) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }
    }
    return { group, liberties: liberties.size };
  }

  function coordLabel(pos) {
    const b = Math.floor(pos.r / 3) * 3 + Math.floor(pos.c / 3);
    const cell = (pos.r % 3) * 3 + (pos.c % 3);
    return `B${b+1}-${CELL_NAMES[cell]}`;
  }

  function finishByDecisiveCapture(lostColors, captureSummary) {
    if (gamePhase === 'gameover' || lostColors.length === 0) return;

    gamePhase = 'gameover';
    isWallDeclarationActive = false;

    // v2.8-test: 15個以上の損失は即終局のトリガーに限定し、
    // 片側損失・双方損失のどちらでも、加算済みの累計得点で勝敗を決める。
    let winner = 'Draw';
    let resultText = '累計得点も同点のため引き分け';

    if (playerScores.white > playerScores.black) {
      winner = 'White';
      resultText = '累計得点により白の勝利';
    } else if (playerScores.black > playerScores.white) {
      winner = 'Black';
      resultText = '累計得点により黒の勝利';
    }

    const lossText = lostColors.length === 2
      ? '白黒が同時に15個以上を失い'
      : `${lostColors[0] === 'white' ? '白' : '黒'}が一度に15個以上を失い`;

    gameEndInfo = {
      winner,
      reason: 'CAPTURE_15_SCORE',
      turns: turnNumber,
      detail: `${captureSummary} / 白:${playerScores.white}pt / 黒:${playerScores.black}pt`
    };

    logMessage(`【15個捕獲決着】${lossText}、${resultText}（${captureSummary} / 白:${playerScores.white}pt / 黒:${playerScores.black}pt）`);
    if (testBot && testBot.intervalId) testBot.stop('15個以上の一括捕獲で得点決着');
  }

  function finishByNoLegalMove(reason = '合法な配置手なし') {
    if (gamePhase === 'gameover') return;
    gamePhase = 'gameover';
    isWallDeclarationActive = false;

    let resultText = '引き分け';
    let winner = 'Draw';
    if (playerScores.white > playerScores.black) {
      resultText = '白の勝利';
      winner = 'White';
    } else if (playerScores.black > playerScores.white) {
      resultText = '黒の勝利';
      winner = 'Black';
    }
    gameEndInfo = {
      winner,
      reason: 'NO_LEGAL_PLACE',
      turns: Math.max(0, turnNumber - 1),
      detail: reason
    };

    logMessage(`【合法手なし決着】${reason}。${resultText}（白:${playerScores.white}pt / 黒:${playerScores.black}pt）`);
    if (testBot && testBot.intervalId) testBot.stop('合法な配置手がないため得点判定');
    renderBoard();
  }

  function finishByTurnLimit() {
    if (gamePhase === 'gameover') return;

    gamePhase = 'gameover';
    isWallDeclarationActive = false;

    let resultText = '引き分け';
    let winner = 'Draw';
    if (playerScores.white > playerScores.black) {
      resultText = '白の得点勝利';
      winner = 'White';
    } else if (playerScores.black > playerScores.white) {
      resultText = '黒の得点勝利';
      winner = 'Black';
    }
    gameEndInfo = {
      winner,
      reason: 'TURN_LIMIT',
      turns: MAX_TURNS,
      detail: ''
    };

    logMessage(`【${MAX_TURNS}ターン決着】${resultText}（白:${playerScores.white}pt / 黒:${playerScores.black}pt）`);
    if (testBot && testBot.intervalId) testBot.stop(`${MAX_TURNS}ターン到達で得点判定`);
    renderBoard();
  }

  function logLargeCapture(details) {
    const total = details.groups.reduce((sum, g) => sum + g.positions.length, 0);
    if (total < DECISIVE_CAPTURE_THRESHOLD) return;
    logMessage(`【大量捕獲検知】経路=${diagnosticContext} / BOTstep=${botStepSerial} / turn=${turnNumber} / phase=${gamePhase} / player=${currentPlayer} / 合計=${total}`);
    details.groups.forEach((g, i) => {
      const coords = g.positions.map(coordLabel).join(',');
      logMessage(`【対象群${i+1}】色=${g.stone} 数=${g.positions.length} 座標=${coords}`);
    });
  }

  function detectCapturedGroups(grid) {
    let checked = Array.from({length: 9}, () => Array(9).fill(false));
    let groups = [];

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const stone = grid[r][c];
        if ((stone === 'white' || stone === 'black' || stone === 'blue') && !checked[r][c]) {
          const res = getGroupLiberties(grid, r, c);
          res.group.forEach(pos => { checked[pos.r][pos.c] = true; });
          if (res.liberties === 0) {
            groups.push({ stone, positions: res.group });
          }
        }
      }
    }
    return groups;
  }

  function secureBlueStones(player, count, sourceLabel = '捕獲') {
    if (!player || count <= 0) return;
    const addedProtection = count * BLUE_SHIELD_PER_STONE;
    blueStonesSecured[player] += count;
    blueProtectionRemaining[player] += addedProtection;
    logMessage(`【青石確保】${player === 'white' ? '白' : '黒'}が青石${count}個を確保。得点0、ガス保護枠+${addedProtection}（残り${blueProtectionRemaining[player]}）［${sourceLabel}］`);
  }

  function globalToBlockCell(r, c) {
    return {
      b: Math.floor(r / 3) * 3 + Math.floor(c / 3),
      cell: (r % 3) * 3 + (c % 3)
    };
  }

  function isGasProtectedAt(r, c) {
    const pos = globalToBlockCell(r, c);
    return !!gasProtectedBoard[pos.b][pos.cell];
  }

  function setGasProtectedAt(r, c, value) {
    const pos = globalToBlockCell(r, c);
    gasProtectedBoard[pos.b][pos.cell] = !!value;
  }

  function clearGasProtectionForPositions(positions) {
    positions.forEach(pos => setGasProtectedAt(pos.r, pos.c, false));
  }

  function resolveAllCapturesSimultaneously(grid, eventOwner = null, isSuicideCheck = false) {
    const groups = detectCapturedGroups(grid);
    if (groups.length === 0) return 0;

    const scoreDelta = { white: 0, black: 0 };
    const capturedCount = { white: 0, black: 0, blue: 0 };

    // 判定が終わるまで盤面を変更しない。これで白・黒の処理順による偏りを消す。
    for (const group of groups) {
      const count = group.positions.length;
      capturedCount[group.stone] += count;

      if (group.stone === 'white') scoreDelta.black += count;
      else if (group.stone === 'black') scoreDelta.white += count;
      else if (group.stone === 'blue' && eventOwner) secureBlueStones(eventOwner, count, 'スライド捕獲');
    }

    logLargeCapture({ groups });

    for (const group of groups) {
      clearGasProtectionForPositions(group.positions);
      group.positions.forEach(pos => { grid[pos.r][pos.c] = null; });
    }

    playerScores.white += scoreDelta.white;
    playerScores.black += scoreDelta.black;

    const typeStr = isSuicideCheck ? '自滅パージ' : '同時捕獲';
    if (scoreDelta.white > 0) logMessage(`【${typeStr}】白 が +${scoreDelta.white} pt を獲得`);
    if (scoreDelta.black > 0) logMessage(`【${typeStr}】黒 が +${scoreDelta.black} pt を獲得`);

    const lostColors = [];
    if (capturedCount.white >= DECISIVE_CAPTURE_THRESHOLD) lostColors.push('white');
    if (capturedCount.black >= DECISIVE_CAPTURE_THRESHOLD) lostColors.push('black');
    if (lostColors.length > 0) {
      finishByDecisiveCapture(
        lostColors,
        `白損失:${capturedCount.white} / 黒損失:${capturedCount.black}`
      );
    }

    return groups.reduce((sum, group) => sum + group.positions.length, 0);
  }

  function processCaptures(grid, capturer, isSuicideCheck = false) {
    const targetColor = capturer === 'white' ? 'black' : 'white';
    const checked = Array.from({length: 9}, () => Array(9).fill(false));
    const capturedNormal = [];
    const capturedBlue = [];

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const stone = grid[r][c];
        if ((stone === targetColor || stone === 'blue') && !checked[r][c]) {
          const res = getGroupLiberties(grid, r, c);
          res.group.forEach(pos => { checked[pos.r][pos.c] = true; });
          if (res.liberties === 0) {
            if (stone === 'blue') capturedBlue.push(...res.group);
            else capturedNormal.push(...res.group);
          }
        }
      }
    }

    if (capturedNormal.length > 0) {
      logLargeCapture({ groups: [{ stone: targetColor, positions: capturedNormal }] });
    }

    clearGasProtectionForPositions([...capturedNormal, ...capturedBlue]);
    [...capturedNormal, ...capturedBlue].forEach(pos => { grid[pos.r][pos.c] = null; });

    if (capturedNormal.length > 0) {
      playerScores[capturer] += capturedNormal.length;
      const typeStr = isSuicideCheck ? '自滅パージ' : '捕獲成功';
      logMessage(`【${typeStr}】${capturer === 'white' ? '白' : '黒'} が敵石 ${capturedNormal.length}個を回収！ (+${capturedNormal.length} pt)`);
    }
    if (capturedBlue.length > 0) {
      secureBlueStones(capturer, capturedBlue.length, isSuicideCheck ? '自滅パージ' : '配置捕獲');
    }

    if (capturedNormal.length >= DECISIVE_CAPTURE_THRESHOLD) {
      finishByDecisiveCapture(
        [targetColor],
        `${targetColor === 'white' ? '白' : '黒'}損失:${capturedNormal.length}`
      );
    }
    return capturedNormal.length + capturedBlue.length;
  }

  function isSuicideMove(b, c, playerColor) {
    let tempGrid = get9x9Grid(board);
    let r = Math.floor(b / 3) * 3 + Math.floor(c / 3);
    let col = (b % 3) * 3 + (c % 3);

    tempGrid[r][col] = playerColor;

    let opponentColor = playerColor === 'white' ? 'black' : 'white';
    let dr = [-1, 1, 0, 0], dc = [0, 0, -1, 1];
    for (let i = 0; i < 4; i++) {
      let nr = r + dr[i], nc = col + dc[i];
      if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
        if (tempGrid[nr][nc] === opponentColor || tempGrid[nr][nc] === 'blue') {
          let res = getGroupLiberties(tempGrid, nr, nc);
          if (res.liberties === 0) return false;
        }
      }
    }

    let selfRes = getGroupLiberties(tempGrid, r, col);
    return selfRes.liberties === 0;
  }


  // v2.5.1: 配置直後の捕獲結果を副作用なしで再現し、単純コウを判定する。
  function simulatePlacementResult(b, c, playerColor) {
    const tempBoard = board.map(block => [...block]);
    tempBoard[b][c] = playerColor;
    const tempGrid = get9x9Grid(tempBoard);
    const targetColor = playerColor === 'white' ? 'black' : 'white';
    const checked = Array.from({ length: 9 }, () => Array(9).fill(false));
    const captured = [];

    for (let r = 0; r < 9; r++) {
      for (let col = 0; col < 9; col++) {
        const stone = tempGrid[r][col];
        if ((stone === targetColor || stone === 'blue') && !checked[r][col]) {
          const res = getGroupLiberties(tempGrid, r, col);
          res.group.forEach(pos => { checked[pos.r][pos.c] = true; });
          if (res.liberties === 0) captured.push(...res.group);
        }
      }
    }

    captured.forEach(pos => { tempGrid[pos.r][pos.c] = null; });
    set9x9GridToBoard(tempGrid, tempBoard);
    return tempBoard;
  }

  function boardStateKey(boardData) {
    return boardData.map(block => block.map(cell => cell ?? '.').join(',')).join('|');
  }

  function isKoRepeatMove(b, c, playerColor) {
    // 現在局面は末尾スナップショット。1手前へ戻る形だけを禁止する単純コウ。
    if (boardSnapshots.length < 2) return false;
    const resultBoard = simulatePlacementResult(b, c, playerColor);
    const previousPosition = boardSnapshots[boardSnapshots.length - 2].board;
    return boardStateKey(resultBoard) === boardStateKey(previousPosition);
  }

  function saveBoardSnapshot() {
    boardSnapshots.push({ turn: turnNumber, board: board.map(arr => [...arr]) });
  }

  function cloneTurnMove(move) {
    return { place: move.place, slide: move.slide, event: move.event };
  }

  function saveUndoState() {
    undoHistory.push({
      board: board.map(row => [...row]),
      emptyCount,
      wallCount: { ...wallCount },
      playerScores: { ...playerScores },
      slideLockedBlocks: [...slideLockedBlocks],
      currentPlayer,
      gamePhase,
      setupCount,
      isWallDeclarationActive,
      redReservations: redReservations.map(res => ({ ...res })),
      blueDropState: { ...blueDropState },
      blueProtectionRemaining: { ...blueProtectionRemaining },
      blueStonesSecured: { ...blueStonesSecured },
      gasProtectedBoard: gasProtectedBoard.map(row => [...row]),
      gasPhaseActive,
      ntpnMoveHistory: [...ntpnMoveHistory],
      boardSnapshots: boardSnapshots.map(snap => ({ turn: snap.turn, board: snap.board.map(row => [...row]) })),
      currentTurnMove: cloneTurnMove(currentTurnMove),
      turnNumber
    });
    updateUndoButton();
  }

  function updateUndoButton() {
    const btn = document.getElementById('btn-undo');
    if (btn) btn.disabled = undoHistory.length === 0;
  }

  function undoOneMove() {
    if (undoHistory.length === 0) return;
    if (testBot.intervalId) testBot.stop();

    const state = undoHistory.pop();
    board = state.board.map(row => [...row]);
    emptyCount = state.emptyCount;
    wallCount = { ...state.wallCount };
    playerScores = { ...state.playerScores };
    slideLockedBlocks = [...state.slideLockedBlocks];
    currentPlayer = state.currentPlayer;
    gamePhase = state.gamePhase;
    setupCount = state.setupCount;
    isWallDeclarationActive = state.isWallDeclarationActive;
    redReservations = state.redReservations.map(res => ({ ...res }));
    blueDropState = { ...state.blueDropState };
    blueProtectionRemaining = { ...state.blueProtectionRemaining };
    blueStonesSecured = { ...state.blueStonesSecured };
    gasProtectedBoard = state.gasProtectedBoard.map(row => [...row]);
    gasPhaseActive = state.gasPhaseActive;
    ntpnMoveHistory = [...state.ntpnMoveHistory];
    boardSnapshots = state.boardSnapshots.map(snap => ({ turn: snap.turn, board: snap.board.map(row => [...row]) }));
    currentTurnMove = cloneTurnMove(state.currentTurnMove);
    turnNumber = state.turnNumber;

    const wallBtn = document.getElementById('btn-wall-declare');
    if (wallBtn) {
      wallBtn.style.outline = isWallDeclarationActive ? '2px solid #66fcf1' : 'none';
      wallBtn.innerText = isWallDeclarationActive ? '【選択中】置きたいマスをクリック (申告)' : '赤石 (絶対障壁) をセット申告';
    }

    logMessage(`【一手戻る】ターン${turnNumber}の行動前へ復元しました。`);
    renderBoard();
  }

  function logMessage(msg) {
    const logPanel = document.getElementById('log-panel');
    if (!logPanel) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    logPanel.innerHTML += `[${time}] ${msg}<br>`;
    logPanel.scrollTop = logPanel.scrollHeight;
  }


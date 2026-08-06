/* Nine Topology v2.8-test: capture and protected-state overrides
   Loaded after the shared v2.7.2 module and replaces only rule-dependent functions. */

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

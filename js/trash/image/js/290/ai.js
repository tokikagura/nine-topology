  function getActiveExternalEngine() {
    const sideEngine = currentPlayer === 'white'
      ? window.NTAI_Engine_White
      : window.NTAI_Engine_Black;
    return sideEngine || window.NTAI_Engine || null;
  }

  function getExternalMove(engine) {
    if (!engine || typeof engine.decideNextMove !== 'function') return null;
    try {
      const gameState = {
        player: currentPlayer,
        phase: gamePhase,
        redWallsLeft: wallCount[currentPlayer],
        scores: { ...playerScores },
        turnNumber,
        emptyCount,
        gasPhaseActive,
        blueProtectionRemaining: { ...blueProtectionRemaining },
        blueStonesSecured: { ...blueStonesSecured },
        blueDropState: { ...blueDropState },
        blueDropSchedule: BLUE_DROP_EVENTS.map(event => ({ ...event })),
        gasProtectedBoard: gasProtectedBoard.map(block => [...block]),
        slideLockedBlocks: [...slideLockedBlocks]
      };
      return engine.decideNextMove(board.map(block => [...block]), gameState);
    } catch (error) {
      logMessage(`【外部AIエラー】${error.message}。内蔵BOTへ切り替えます。`);
      return null;
    }
  }

  function countOwnStonesInBlock(blockIndex, playerColor) {
    return board[blockIndex].reduce((count, cell) => count + (cell === playerColor ? 1 : 0), 0);
  }

  function getGasTargetsForGrid(grid) {
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
          const stone = grid[nr][nc];
          if (stone === 'white' || stone === 'black') {
            targets.set(`${nr},${nc}`, { r: nr, c: nc, stone });
          }
        }
      }
    }
    return [...targets.values()];
  }

  function evaluateGasAwarePlacement(b, c, playerColor) {
    // 配置とその直後の通常捕獲までを副作用なしで再現する。
    const simulatedBoard = simulatePlacementResult(b, c, playerColor);
    const grid = get9x9Grid(simulatedBoard);
    const targets = getGasTargetsForGrid(grid);
    const opponent = playerColor === 'white' ? 'black' : 'white';

    let ownLoss = 0;
    let opponentLoss = 0;
    for (const target of targets) {
      if (target.stone === playerColor) ownLoss++;
      else if (target.stone === opponent) opponentLoss++;
    }

    const r = Math.floor(b / 3) * 3 + Math.floor(c / 3);
    const col = (b % 3) * 3 + (c % 3);
    const placedStoneDies = targets.some(target => target.r === r && target.c === col);

    // 青石の残存保護枠を差し引いた「実被害」で評価する。
    const effectiveOwnLoss = Math.max(0, ownLoss - blueProtectionRemaining[playerColor]);
    const effectiveOpponentLoss = Math.max(0, opponentLoss - blueProtectionRemaining[opponent]);
    let score = effectiveOpponentLoss * 7 - effectiveOwnLoss * 12;
    if (placedStoneDies) score -= 30;

    // 従来の密集回避も弱く残す。
    score -= Math.max(0, countOwnStonesInBlock(b, playerColor) - 5) * 2;
    return { score, ownLoss, opponentLoss, effectiveOwnLoss, effectiveOpponentLoss, placedStoneDies };
  }

  function chooseBuiltInPlacement(validTargets) {
    // 赤石申告は石を置かないため、従来どおり合法候補から選ぶ。
    if (isWallDeclarationActive) {
      return validTargets[Math.floor(Math.random() * validTargets.length)];
    }

    // 現在ガス中、またはこの配置で空き10へ入る局面では専用評価へ切り替える。
    const gasRelevant = gasPhaseActive || emptyCount <= 11;
    if (gasRelevant) {
      const evaluated = validTargets.map(pos => ({
        ...pos,
        ...evaluateGasAwarePlacement(pos.b, pos.c, currentPlayer)
      }));
      const bestScore = Math.max(...evaluated.map(item => item.score));
      const best = evaluated.filter(item => item.score === bestScore);
      const choice = best[Math.floor(Math.random() * best.length)];
      logMessage(`【BOTガス評価】候補${validTargets.length}手 / 最良値${bestScore} / 自軍被害${choice.ownLoss}→${choice.effectiveOwnLoss} / 敵被害${choice.opponentLoss}→${choice.effectiveOpponentLoss}${choice.placedStoneDies ? ' / 配置石も被害' : ''}`);
      return { b: choice.b, c: choice.c };
    }

    // 通常局面では自軍石が7個以上あるブロックへの追加配置を避ける。
    const saferTargets = validTargets.filter(({ b }) => countOwnStonesInBlock(b, currentPlayer) < 7);
    const pool = saferTargets.length > 0 ? saferTargets : validTargets;

    const avoided = validTargets.length - saferTargets.length;
    if (avoided > 0 && saferTargets.length > 0) {
      logMessage(`【BOT評価】自軍石7個以上の密集ブロック候補を${avoided}手回避`);
    } else if (avoided > 0) {
      logMessage('【BOT評価】全合法手が密集ブロック内のため回避制限を解除');
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* === 自動対局用簡易テストBOT === */
  class NineTopologyRestoredTestBot {
    constructor(speedMs = 30) {
      this.speedMs = speedMs;
      this.intervalId = null;
      this.moveCount = 0;
      this.maxMoves = 400; // 128ターン決着より後ろに置く非常停止
    }

    start() {
      const btn = document.getElementById('btn-toggle-bot');
      if (btn) {
        btn.innerText = "【対局中】全自動対局進行中...";
        btn.style.background = "linear-gradient(135deg, #ff0055, #990022)";
      }
      logMessage("【BOT対局開始】v2.8-test スタート！");
      this.moveCount = 0;
      botStepSerial = 0;
    externalDuelAutoStarted = false;
      this.intervalId = setInterval(() => {
        try { this.step(); } 
        catch (error) { this.stop(); logMessage(`【エラー発生】: ${error.message}`); }
      }, this.speedMs);
    }

    stop(reason = null) {
      if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
      const btn = document.getElementById('btn-toggle-bot');
      if (btn) {
        btn.innerText = "【全自動対局】開始 / 停止";
        btn.style.background = "linear-gradient(135deg, #ff9900, #ff5500)";
      }
      logMessage(reason ? `【対局停止】${reason}` : "【対局停止】シミュレーションを停止しました。");
    }

    step() {
      if (gamePhase === 'gameover') {
        this.stop('対局は終了しています');
        return;
      }

      botStepSerial++;
      diagnosticContext = `BOT_STEP_BEGIN phase=${gamePhase}`;
      logMessage(`【BOT STEP ${botStepSerial}】turn=${turnNumber} phase=${gamePhase} player=${currentPlayer}`);
      this.moveCount++;
      if (this.moveCount > this.maxMoves) {
        this.stop();
        logMessage("【安全停止】異常継続を検知したため400ステップで停止しました。");
        return;
      }

      if (gamePhase === 'setup') {
        const engine = getActiveExternalEngine();
        const externalMove = getExternalMove(engine);
        if (externalMove && externalMove.place &&
            isValidPlaceTarget(externalMove.place.b, externalMove.place.c)) {
          logMessage(`【外部AI判断】SETUP B${externalMove.place.b+1}-${CELL_NAMES[externalMove.place.c]}`);
          handleCellClick(externalMove.place.b, externalMove.place.c);
          return;
        }

        const validTargets = [];
        for (let b of CORNER_BLOCKS) {
          for (let c = 0; c < 9; c++) {
            if (isValidPlaceTarget(b, c)) validTargets.push({ b, c });
          }
        }
        if (validTargets.length === 0) throw new Error("準備フェーズ配置不能");
        const choice = validTargets[Math.floor(Math.random() * validTargets.length)];
        logMessage(`【BOT判断】SETUP B${choice.b+1}-${CELL_NAMES[choice.c]}`);
        handleCellClick(choice.b, choice.c);
        return;
      }

      if (gamePhase === 'place') {
        const engine = getActiveExternalEngine();
        const externalMove = getExternalMove(engine);
        if (externalMove && externalMove.place) {
          const eb = externalMove.place.b;
          const ec = externalMove.place.c;
          if (isValidPlaceTarget(eb, ec)) {
            isWallDeclarationActive = !!externalMove.place.secretRed && wallCount[currentPlayer] > 0;
            logMessage(`【外部AI判断】PLACE B${eb+1}-${CELL_NAMES[ec]} redMode=${isWallDeclarationActive}`);
            handleCellClick(eb, ec);
            return;
          }
          if (Number.isInteger(eb) && Number.isInteger(ec) && board[eb] && board[eb][ec] === null && isKoRepeatMove(eb, ec, currentPlayer)) {
            logMessage(`【コウ禁止】外部AIの B${eb+1}-${CELL_NAMES[ec]} は直前局面の再現になるため却下。`);
          }
        }

        // 赤石のランダム申告 (15%の確率)
        if (wallCount[currentPlayer] > 0 && Math.random() < 0.15) {
          isWallDeclarationActive = true;
        } else {
          isWallDeclarationActive = false;
        }

        const validTargets = [];
        for (let b = 0; b < 9; b++) {
          for (let c = 0; c < 9; c++) {
            if (isValidPlaceTarget(b, c)) validTargets.push({ b, c });
          }
        }

        if (validTargets.length === 0) {
          // v2.5g: PLACE中に合法手がない状態でskipSlide()を呼ぶと何も起きず、
          // 同じ手番・同じターンを永久反復していた。ここで得点判定して終局する。
          const sideName = currentPlayer === 'white' ? '白' : '黒';
          finishByNoLegalMove(`${sideName}に合法な配置手がありません`);
          return;
        }

        const choice = chooseBuiltInPlacement(validTargets);
        logMessage(`【BOT判断】PLACE B${choice.b+1}-${CELL_NAMES[choice.c]} redMode=${isWallDeclarationActive}`);
        handleCellClick(choice.b, choice.c);
        return;
      }

      if (gamePhase === 'slide') {
        const engine = getActiveExternalEngine();
        const externalMove = getExternalMove(engine);
        if (externalMove && externalMove.slide) {
          if (externalMove.slide.pass === true) {
            logMessage('【外部AI判断】SLIDE PASS');
            skipSlide();
            return;
          }
          if (Number.isInteger(externalMove.slide.b) && externalMove.slide.dir) {
            logMessage(`【外部AI判断】SLIDE B${externalMove.slide.b+1}-${externalMove.slide.dir}`);
            if (executeSlide(externalMove.slide.b, externalMove.slide.dir)) return;
          }
        }

        // ガス局面では、配置時に選んだ安全形をランダムスライドで壊さない。
        if (gasPhaseActive || emptyCount <= 10) {
          logMessage('【BOTガス判断】SLIDE PASS（配置後の安全形を維持）');
          diagnosticContext = 'BOT_GAS_SLIDE_PASS';
          skipSlide();
          return;
        }

        if (Math.random() < 0.4) {
          logMessage('【BOT判断】SLIDE PASS');
          diagnosticContext = 'BOT_SLIDE_PASS';
          skipSlide();
          return;
        }

        const availableBlocks = [];
        for (let b = 0; b < 9; b++) {
          if (!slideLockedBlocks.includes(b)) availableBlocks.push(b);
        }

        if (availableBlocks.length === 0) {
          skipSlide();
          return;
        }

        const targetBlock = availableBlocks[Math.floor(Math.random() * availableBlocks.length)];
        const dirs = ['up', 'down', 'left', 'right'];
        const chosenDir = dirs[Math.floor(Math.random() * dirs.length)];
        logMessage(`【BOT判断】SLIDE B${targetBlock+1}-${chosenDir}`);
        executeSlide(targetBlock, chosenDir);
        return;
      }
    }
  }

  const testBot = new NineTopologyRestoredTestBot(30);

  function toggleTestBot() {
    if (testBot.intervalId) {
      testBot.stop();
    } else {
      testBot.start();
    }
  }

  // runner.html が外部AIを注入したら、同じ対局ボタン操作として自動開始する。
  setInterval(() => {
    const hasExternalEngine = !!(window.NTAI_Engine_White || window.NTAI_Engine_Black || window.NTAI_Engine);
    if (hasExternalEngine && !externalDuelAutoStarted && !testBot.intervalId && gamePhase !== 'gameover') {
      externalDuelAutoStarted = true;
      logMessage('【NTAI接続】外部AIを検出。対局を開始します。');
      testBot.start();
    }
  }, 200);


  function getActiveExternalEngine() {
    const sideEngine = currentPlayer === 'white'
      ? window.NTAI_Engine_White
      : window.NTAI_Engine_Black;
    return sideEngine || window.NTAI_Engine || null;
  }

  function getExternalMove(engine) {
    externalEngineLastError = null;
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
      externalEngineLastError = String(error && error.message ? error.message : error);
      logMessage(`【外部AIエラー】${externalEngineLastError}。公平性保護のため対局停止対象です。`);
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

  function collectLegalPlaceTargets() {
    const targets = [];
    for (let b = 0; b < 9; b++) {
      for (let c = 0; c < 9; c++) {
        if (isValidPlaceTarget(b, c)) targets.push({ b, c });
      }
    }
    return targets;
  }

  function collectLegalSetupTargets() {
    const targets = [];
    for (const b of CORNER_BLOCKS) {
      for (let c = 0; c < 9; c++) {
        if (isValidPlaceTarget(b, c)) targets.push({ b, c });
      }
    }
    return targets;
  }

  function diagnosticResponseText(value) {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    try {
      const text = JSON.stringify(value, (_key, item) => {
        if (typeof item === 'function') return '[Function]';
        if (typeof item === 'bigint') return String(item);
        return item;
      });
      return String(text ?? value).replace(/[\r\n\]]+/g, ' ').slice(0, 260);
    } catch (_) {
      return String(value).replace(/[\r\n\]]+/g, ' ').slice(0, 260);
    }
  }

  function legalTargetExamples(targets, limit = 8) {
    return targets.slice(0, limit)
      .map(pos => `B${pos.b + 1}-${CELL_NAMES[pos.c]}`)
      .join(',') || 'none';
  }

  function classifyInvalidSetupMove(move) {
    if (externalEngineLastError) return { code: 'ENGINE_EXCEPTION', detail: externalEngineLastError };
    if (move == null) return { code: 'NULL_RESPONSE', detail: 'AI応答がnull/undefinedです' };
    if (!move.place) return { code: 'MISSING_PLACE', detail: '応答にplaceがありません' };
    const { b, c } = move.place;
    if (!Number.isInteger(b) || !Number.isInteger(c)) return { code: 'BAD_COORD_TYPE', detail: `setup座標が整数ではありません b=${b} c=${c}` };
    if (b < 0 || b >= 9 || c < 0 || c >= 9) return { code: 'OUT_OF_RANGE', detail: `setup座標が範囲外 b=${b} c=${c}` };
    if (board[b][c] !== null) return { code: 'OCCUPIED', detail: `setup先B${b+1}-${CELL_NAMES[c]}は${board[b][c]}で埋まっています` };
    if (!CORNER_BLOCKS.includes(b)) return { code: 'NOT_CORNER', detail: `setup先B${b+1}-${CELL_NAMES[c]}は四隅ブロックではありません` };
    if (board[b].some(stone => stone === currentPlayer)) return { code: 'DUPLICATE_SETUP_BLOCK', detail: `B${b+1}には自色setup石が既にあります` };
    return { code: 'UNKNOWN_ILLEGAL', detail: `setup先B${b+1}-${CELL_NAMES[c]}が現行ルールで不合法です` };
  }

  function classifyInvalidPlaceMove(move) {
    if (externalEngineLastError) return { code: 'ENGINE_EXCEPTION', detail: externalEngineLastError };
    if (move == null) return { code: 'NULL_RESPONSE', detail: 'AI応答がnull/undefinedです' };
    if (!move.place) return { code: 'MISSING_PLACE', detail: '応答にplaceがありません' };
    const { b, c } = move.place;
    if (!Number.isInteger(b) || !Number.isInteger(c)) return { code: 'BAD_COORD_TYPE', detail: `place座標が整数ではありません b=${b} c=${c}` };
    if (b < 0 || b >= 9 || c < 0 || c >= 9) return { code: 'OUT_OF_RANGE', detail: `place座標が範囲外 b=${b} c=${c}` };
    if (board[b][c] !== null) return { code: 'OCCUPIED', detail: `B${b+1}-${CELL_NAMES[c]}は${board[b][c]}で埋まっています` };
    if (isSuicideMove(b, c, currentPlayer)) return { code: 'SUICIDE', detail: `B${b+1}-${CELL_NAMES[c]}は現行ルールの自殺手判定です` };
    if (isKoRepeatMove(b, c, currentPlayer)) return { code: 'KO_REPEAT', detail: `B${b+1}-${CELL_NAMES[c]}はコウによる直前局面再現です` };
    return { code: 'UNKNOWN_ILLEGAL', detail: `B${b+1}-${CELL_NAMES[c]}が現行ルールで不合法です` };
  }

  function classifyInvalidSlideMove(move) {
    if (externalEngineLastError) return { code: 'ENGINE_EXCEPTION', detail: externalEngineLastError };
    if (move == null) return { code: 'NULL_RESPONSE', detail: 'AI応答がnull/undefinedです' };
    if (!move.slide) return { code: 'MISSING_SLIDE', detail: '応答にslideがありません' };
    if (move.slide.pass === true) return { code: 'UNKNOWN_ILLEGAL', detail: 'pass応答を処理できませんでした' };
    const { b, dir } = move.slide;
    if (!Number.isInteger(b)) return { code: 'BAD_BLOCK_TYPE', detail: `slide.bが整数ではありません b=${b}` };
    if (b < 0 || b >= 9) return { code: 'OUT_OF_RANGE', detail: `slideブロックが範囲外 b=${b}` };
    if (!['up', 'down', 'left', 'right'].includes(dir)) return { code: 'BAD_DIRECTION', detail: `slide方向が不正 dir=${dir}` };
    if (slideLockedBlocks.includes(b)) return { code: 'BLOCK_LOCKED', detail: `B${b+1}は現在slide禁止です` };
    return { code: 'UNKNOWN_ILLEGAL', detail: `B${b+1}-${dir}を実行できませんでした` };
  }

  /* === 自動対局用簡易テストBOT === */
  class NineTopologyRestoredTestBot {
    constructor(speedMs = 30) {
      this.speedMs = speedMs;
      this.intervalId = null;
      this.moveCount = 0;
      this.maxMoves = 400; // 128ターン決着より後ろに置く非常停止
    }

    abortExternalTurn(phase, engine, issue, legalTargets = []) {
      const side = currentPlayer === 'white' ? 'W' : 'B';
      const rawName = engine && engine.name ? String(engine.name) : 'ExternalEngine';
      const safeName = rawName.replace(/[^0-9A-Za-z._-]+/g, '_');
      const code = issue && issue.code ? issue.code : 'INVALID_ACTION';
      const rawDetail = issue && issue.detail ? issue.detail : 'invalid action';
      const safeDetail = String(rawDetail).replace(/[\r\n\]]+/g, ' ').slice(0, 220);
      const responseText = diagnosticResponseText(externalEngineLastResponse);
      const examples = legalTargetExamples(legalTargets);
      const diagnostic = `code=${code} legal=${legalTargets.length} response=${responseText} examples=${examples} detail=${safeDetail}`;

      ntpnSystemEvents.push(
        `[EVENT:ENGINE_ABORT turn=${turnNumber} side=${side} phase=${phase} engine=${safeName} ${diagnostic}]`
      );
      diagnosticContext = `ENGINE_ABORT phase=${phase} side=${side} code=${code}`;
      gameEndInfo = {
        winner: 'IN_PROGRESS',
        reason: 'ENGINE_ABORT',
        turns: Math.max(0, turnNumber - 1),
        detail: `${rawName} / ${phase} / ${code} / ${safeDetail}`
      };
      externalDuelAutoStarted = true;
      this.stop(`外部AI ${rawName} の${phase}応答が無効なため対局を中断`);
      logMessage(`【外部AI対局中断】${rawName} / phase=${phase} / code=${code} / legal=${legalTargets.length}`);
      logMessage(`【診断】response=${responseText} / legal例=${examples} / ${safeDetail}`);
    }

    start() {
      const btn = document.getElementById('btn-toggle-bot');
      if (btn) {
        btn.innerText = "【対局中】全自動対局進行中...";
        btn.style.background = "linear-gradient(135deg, #ff0055, #990022)";
      }
      logMessage("【BOT対局開始】v2.9.2-test スタート！");
      this.moveCount = 0;
      botStepSerial = 0;
      externalDuelAutoStarted = !!(window.NTAI_Engine_White || window.NTAI_Engine_Black || window.NTAI_Engine);
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
        const validTargets = collectLegalSetupTargets();
        if (validTargets.length === 0) throw new Error("準備フェーズ配置不能");

        const engine = getActiveExternalEngine();
        const externalMove = getExternalMove(engine);
        if (engine) {
          if (externalMove && externalMove.place &&
              Number.isInteger(externalMove.place.b) && Number.isInteger(externalMove.place.c) &&
              isValidPlaceTarget(externalMove.place.b, externalMove.place.c)) {
            logMessage(`【外部AI判断】SETUP B${externalMove.place.b+1}-${CELL_NAMES[externalMove.place.c]}`);
            handleCellClick(externalMove.place.b, externalMove.place.c);
            return;
          }
          this.abortExternalTurn('setup', engine, classifyInvalidSetupMove(externalMove), validTargets);
          return;
        }
        const choice = validTargets[Math.floor(Math.random() * validTargets.length)];
        logMessage(`【BOT判断】SETUP B${choice.b+1}-${CELL_NAMES[choice.c]}`);
        handleCellClick(choice.b, choice.c);
        return;
      }

      if (gamePhase === 'place') {
        // 先にゲーム本体の合法手を確定する。合法手0なら外部AIへ問い合わせず正常終局。
        const validTargets = collectLegalPlaceTargets();
        if (validTargets.length === 0) {
          const sideName = currentPlayer === 'white' ? '白' : '黒';
          finishByNoLegalMove(`${sideName}に合法な配置手がありません`);
          return;
        }

        const engine = getActiveExternalEngine();
        const externalMove = getExternalMove(engine);
        if (externalMove && externalMove.place) {
          const eb = externalMove.place.b;
          const ec = externalMove.place.c;
          if (Number.isInteger(eb) && Number.isInteger(ec) &&
              eb >= 0 && eb < 9 && ec >= 0 && ec < 9 &&
              isValidPlaceTarget(eb, ec)) {
            isWallDeclarationActive = !!externalMove.place.secretRed && wallCount[currentPlayer] > 0;
            logMessage(`【外部AI判断】PLACE B${eb+1}-${CELL_NAMES[ec]} redMode=${isWallDeclarationActive}`);
            handleCellClick(eb, ec);
            return;
          }
        }
        if (engine) {
          this.abortExternalTurn('place', engine, classifyInvalidPlaceMove(externalMove), validTargets);
          return;
        }

        // 赤石のランダム申告 (15%の確率)。外部AI不在時のみ使用する。
        if (wallCount[currentPlayer] > 0 && Math.random() < 0.15) {
          isWallDeclarationActive = true;
        } else {
          isWallDeclarationActive = false;
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
          const sb = externalMove.slide.b;
          const sd = externalMove.slide.dir;
          if (Number.isInteger(sb) && sb >= 0 && sb < 9 &&
              ['up', 'down', 'left', 'right'].includes(sd) &&
              !slideLockedBlocks.includes(sb)) {
            logMessage(`【外部AI判断】SLIDE B${sb+1}-${sd}`);
            if (executeSlide(sb, sd)) return;
          }
        }
        if (engine) {
          this.abortExternalTurn('slide', engine, classifyInvalidSlideMove(externalMove), []);
          return;
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


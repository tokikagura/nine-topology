/* Nine Topology v2.8-test: AI API and Gas-evaluation overrides
   Loaded after the shared v2.7.2 module and replaces only rule-dependent functions. */

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

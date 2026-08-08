/* Nine Topology v2.9 experimental rules overlay.
   Independent test build. Loaded after the v2.8-derived base modules. */

const V290_BLUE_CANDIDATES = [
  { id: 'B2', block: 1, cell: 4 },
  { id: 'B4', block: 3, cell: 4 },
  { id: 'B6', block: 5, cell: 4 },
  { id: 'B8', block: 7, cell: 4 }
];
const V290_BLUE_TURN = 99;
const V290_GAS_TURN = 104;

let v290BlueDropped = false;
let v290BlueSecuredOwner = null;
let v290RainRightOwner = null;
let v290RainDeclared = false;
let v290RainPending = false;
let v290RainActivated = false;
let v290NormalPlacementHistory = [];

function v290CandidateKey(item) {
  return `${item.id}-${CELL_NAMES[item.cell]}`;
}

function v290GlobalCoord(b, c) {
  return {
    r: Math.floor(b / 3) * 3 + Math.floor(c / 3),
    col: (b % 3) * 3 + (c % 3)
  };
}

function v290DistanceFromMove(move, candidate) {
  const from = v290GlobalCoord(move.b, move.c);
  const to = v290GlobalCoord(candidate.block, candidate.cell);
  return Math.abs(from.r - to.r) + Math.abs(from.col - to.col);
}

function v290CountEmptyInBlock(blockIndex) {
  return board[blockIndex].reduce((n, cell) => n + (cell === null ? 1 : 0), 0);
}

function v290CountRedInBlock(blockIndex) {
  return board[blockIndex].reduce((n, cell) => n + (cell === 'red' ? 1 : 0), 0);
}

function v290ChooseBlueCandidate() {
  let pool = V290_BLUE_CANDIDATES.map(item => ({
    ...item,
    empty: v290CountEmptyInBlock(item.block),
    red: v290CountRedInBlock(item.block)
  }));

  const maxEmpty = Math.max(...pool.map(x => x.empty));
  pool = pool.filter(x => x.empty === maxEmpty);

  if (pool.length > 1) {
    const maxRed = Math.max(...pool.map(x => x.red));
    pool = pool.filter(x => x.red === maxRed);
  }

  if (pool.length > 1 && v290NormalPlacementHistory.length > 0) {
    for (let i = v290NormalPlacementHistory.length - 1; i >= 0 && pool.length > 1; i--) {
      const move = v290NormalPlacementHistory[i];
      const maxDistance = Math.max(...pool.map(x => v290DistanceFromMove(move, x)));
      pool = pool.filter(x => v290DistanceFromMove(move, x) === maxDistance);
    }
  }

  const fixedOrder = ['B2', 'B4', 'B6', 'B8'];
  pool.sort((a, b) => fixedOrder.indexOf(a.id) - fixedOrder.indexOf(b.id));
  return pool[0];
}

function v290ReleaseUnusedBlueReservations(chosen) {
  for (const candidate of V290_BLUE_CANDIDATES) {
    if (candidate.id === chosen.id) continue;
    if (board[candidate.block][candidate.cell] === 'blue-reserved') {
      board[candidate.block][candidate.cell] = null;
    }
  }
}

function v290CanCallRain() {
  return gamePhase === 'place' &&
    gasPhaseActive &&
    !v290RainDeclared &&
    !v290RainActivated &&
    v290RainRightOwner === currentPlayer;
}

function callRain() {
  if (!v290CanCallRain()) return false;
  v290RainDeclared = true;
  v290RainPending = true;
  appendTurnEvent(`[EVENT:RAIN_DECLARE owner=${currentPlayer === 'white' ? 'W' : 'B'} turn=${turnNumber}]`);
  logMessage(`【雨宣言】${currentPlayer === 'white' ? '白' : '黒'}が雨を呼びました。このターンのガスは発生し、次ターンから停止します。`);
  renderBoard();
  return true;
}
window.callRain = callRain;

function v290ActivatePendingRain() {
  if (!v290RainPending) return;
  v290RainPending = false;
  v290RainActivated = true;
  gasPhaseActive = false;
  appendTurnEvent(`[EVENT:RAIN_START turn=${turnNumber}]`);
  logMessage('【雨】雨が降り始めました。以後Gasは停止します。Neutral Stoneはそのまま残ります。');
}

function v290StartGasIfDue() {
  if (!v290RainActivated && !gasPhaseActive && turnNumber === V290_GAS_TURN) {
    gasPhaseActive = true;
    appendTurnEvent(`[EVENT:GAS_START turn=${turnNumber}]`);
    logMessage(`【ガスフェーズ開始】ターン${turnNumber}。空きマス数に関係なくGasが強制発生します。`);
  }
}

function checkBlueStoneDrop() {
  if (gamePhase !== 'place') return;

  if (!v290BlueDropped && turnNumber === V290_BLUE_TURN) {
    const chosen = v290ChooseBlueCandidate();
    const target = board[chosen.block][chosen.cell];
    if (target !== 'blue-reserved') {
      logMessage(`【青石降臨エラー】${v290CandidateKey(chosen)} の予約マーカーがありません。`);
    } else {
      board[chosen.block][chosen.cell] = 'blue';
      v290ReleaseUnusedBlueReservations(chosen);
      v290BlueDropped = true;
      for (const c of V290_BLUE_CANDIDATES) blueDropState[c.id] = true;
      appendTurnEvent(`[EVENT:BLUE_DROP ${v290CandidateKey(chosen)} turn=${turnNumber} empty=${chosen.empty} red=${chosen.red}]`);
      logMessage(`【青石降臨】${v290CandidateKey(chosen)} に青石が降臨。得点0、確保者はRain Rightを得ます。`);

      const grid = get9x9Grid(board);
      const p = v290GlobalCoord(chosen.block, chosen.cell);
      const res = getGroupLiberties(grid, p.r, p.col);
      if (res.liberties === 0) {
        res.group.forEach(pos => { grid[pos.r][pos.c] = null; });
        set9x9GridToBoard(grid, board);
        secureBlueStones(currentPlayer, res.group.length, '降臨時包囲');
        appendTurnEvent(`[EVENT:BLUE_SECURED owner=${currentPlayer === 'white' ? 'W' : 'B'} count=${res.group.length}]`);
      }
    }
  }

  v290StartGasIfDue();
  v290ActivatePendingRain();
}

function secureBlueStones(player, count, sourceLabel = '捕獲') {
  if (!player || count <= 0 || v290BlueSecuredOwner) return;
  v290BlueSecuredOwner = player;
  v290RainRightOwner = player;
  blueStonesSecured.white = player === 'white' ? 1 : 0;
  blueStonesSecured.black = player === 'black' ? 1 : 0;
  blueProtectionRemaining.white = 0;
  blueProtectionRemaining.black = 0;
  logMessage(`【青石確保】${player === 'white' ? '白' : '黒'}が青石を確保。得点0、Rain Rightを獲得［${sourceLabel}］`);
}

function processEndOfTurnGas() {
  emptyCount = countEmptyCells();
  if (!gasPhaseActive || v290RainActivated) return 0;

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
        const stone = grid[nr][nc];
        if (stone === 'white' || stone === 'black') {
          targets.set(`${nr},${nc}`, { r: nr, c: nc, from: stone });
        }
      }
    }
  }

  const changed = [];
  for (const target of targets.values()) {
    grid[target.r][target.c] = 'neutral';
    changed.push(`${coordLabel(target)}:${target.from === 'white' ? 'W' : 'B'}>N`);
  }

  set9x9GridToBoard(grid, board);
  emptyCount = countEmptyCells();
  if (changed.length > 0) appendTurnEvent(`[EVENT:GAS_NEUTRALIZE ${changed.join(',')}]`);
  logMessage(`【ガス処理】${changed.length}石をNeutral化。得点加算なし。`);
  return changed.length;
}

function restoreFixedBlueReservations() {
  if (v290BlueDropped) return;
  for (const candidate of V290_BLUE_CANDIDATES) {
    const block = board[candidate.block];
    const fixed = candidate.cell;
    if (block[fixed] === 'blue-reserved') continue;
    const moved = block.findIndex(cell => cell === 'blue-reserved');
    if (moved >= 0) {
      const displaced = block[fixed];
      block[fixed] = 'blue-reserved';
      block[moved] = displaced;
    } else {
      block[fixed] = 'blue-reserved';
    }
  }
}

function processRedReservations() {
  const remaining = [];
  for (const res of redReservations) {
    if (res.dueTurn !== turnNumber) {
      remaining.push(res);
      continue;
    }
    if (board[res.b][res.c] === null) {
      board[res.b][res.c] = 'red';
      appendTurnEvent(`[EVENT:RED_APPEAR B${res.b+1}-${CELL_NAMES[res.c]} owner=${res.player === 'white' ? 'W' : 'B'}]`);
      logMessage(`【環境イベント】${res.player === 'white' ? '白' : '黒'}の赤石が B${res.b+1}-${CELL_NAMES[res.c]} に出現。`);
      diagnosticContext = `RED_APPEAR B${res.b+1}-${CELL_NAMES[res.c]} owner=${res.player}`;
      const grid = get9x9Grid(board);
      resolveAllCapturesSimultaneously(grid, res.player, false);
      set9x9GridToBoard(grid, board);
      emptyCount = countEmptyCells();
      if (gamePhase === 'gameover') break;
    } else {
      appendTurnEvent(`[EVENT:RED_FAIL B${res.b+1}-${CELL_NAMES[res.c]} owner=${res.player === 'white' ? 'W' : 'B'}]`);
      logMessage('【不渡り】赤石の出現位置が埋まっていたため設置失敗。');
    }
  }
  redReservations = remaining;
}

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

  blueDropState = { B2: false, B4: false, B6: false, B8: false };
  blueProtectionRemaining = { white: 0, black: 0 };
  blueStonesSecured = { white: 0, black: 0 };
  gasProtectedBoard = Array.from({length: 9}, () => Array(9).fill(false));
  gasPhaseActive = false;

  v290BlueDropped = false;
  v290BlueSecuredOwner = null;
  v290RainRightOwner = null;
  v290RainDeclared = false;
  v290RainPending = false;
  v290RainActivated = false;
  v290NormalPlacementHistory = [];

  for (const candidate of V290_BLUE_CANDIDATES) {
    board[candidate.block][candidate.cell] = 'blue-reserved';
  }

  ntpnMoveHistory = [];
  boardSnapshots = [];
  undoHistory = [];
  currentTurnMove = { place: null, slide: null, event: null };
  turnNumber = 1;
  diagnosticContext = 'SYSTEM';
  botStepSerial = 0;
  externalDuelAutoStarted = false;
  gameEndInfo = { winner: 'IN_PROGRESS', reason: 'IN_PROGRESS', turns: null, detail: '' };

  saveBoardSnapshot();
  const logPanel = document.getElementById('log-panel');
  if (logPanel) logPanel.innerHTML = '';
  logMessage('システム起動 v2.9-test。Blue=Turn99 / Gas=Turn104 / Blue確保でRain Right。');
  renderBoard();
}

const v290BaseHandleCellClick = handleCellClick;
handleCellClick = function(b, c) {
  const phaseBefore = gamePhase;
  const playerBefore = currentPlayer;
  const redBefore = phaseBefore === 'place' && isWallDeclarationActive && wallCount[currentPlayer] > 0;
  const legalBefore = isValidPlaceTarget(b, c);
  if (phaseBefore === 'place' && legalBefore && !redBefore) {
    v290NormalPlacementHistory.push({ b, c, player: playerBefore, turn: turnNumber });
  }
  return v290BaseHandleCellClick(b, c);
};

getExternalMove = function(engine) {
  if (!engine || typeof engine.decideNextMove !== 'function') return null;
  try {
    const gameState = {
      player: currentPlayer,
      phase: gamePhase,
      redWallsLeft: wallCount[currentPlayer],
      scores: { ...playerScores },
      turnNumber,
      maxTurns: MAX_TURNS,
      remainingTurns: MAX_TURNS - turnNumber + 1,
      emptyCount,
      gasPhaseActive,
      gasStartTurn: V290_GAS_TURN,
      blueDropTurn: V290_BLUE_TURN,
      blueDropped: v290BlueDropped,
      blueSecuredOwner: v290BlueSecuredOwner,
      blueStonesSecured: { ...blueStonesSecured },
      blueCandidateBlocks: V290_BLUE_CANDIDATES.map(c => ({
        id: c.id,
        block: c.block,
        cell: c.cell,
        emptyInBlock: v290CountEmptyInBlock(c.block),
        redInBlock: v290CountRedInBlock(c.block)
      })),
      rainRightOwner: v290RainRightOwner,
      rainRightAvailable: v290CanCallRain(),
      rainDeclared: v290RainDeclared,
      rainPending: v290RainPending,
      rainActivated: v290RainActivated,
      slideLockedBlocks: [...slideLockedBlocks]
    };
    const move = engine.decideNextMove(board.map(block => [...block]), gameState);
    if (gamePhase === 'place' && move && move.rain === true && v290CanCallRain()) {
      callRain();
      logMessage('【外部AI判断】RAIN DECLARE');
    }
    return move;
  } catch (error) {
    logMessage(`【外部AIエラー】${error.message}。内蔵BOTへ切り替えます。`);
    return null;
  }
};

const v290BaseChooseBuiltInPlacement = chooseBuiltInPlacement;
chooseBuiltInPlacement = function(validTargets) {
  if (v290CanCallRain()) {
    const opponent = currentPlayer === 'white' ? 'black' : 'white';
    if (playerScores[currentPlayer] >= playerScores[opponent]) {
      callRain();
      logMessage('【BOT雨判断】得点優位を維持するためRainを宣言。');
    }
  }
  return v290BaseChooseBuiltInPlacement(validTargets);
};

const v290BaseSaveUndoState = saveUndoState;
saveUndoState = function() {
  v290BaseSaveUndoState();
  const state = undoHistory[undoHistory.length - 1];
  if (!state) return;
  state.v290 = {
    blueDropped: v290BlueDropped,
    blueSecuredOwner: v290BlueSecuredOwner,
    rainRightOwner: v290RainRightOwner,
    rainDeclared: v290RainDeclared,
    rainPending: v290RainPending,
    rainActivated: v290RainActivated,
    normalPlacementHistory: v290NormalPlacementHistory.map(x => ({ ...x }))
  };
};

const v290BaseUndoOneMove = undoOneMove;
undoOneMove = function() {
  if (undoHistory.length === 0) return;
  const pending = undoHistory[undoHistory.length - 1];
  const extra = pending && pending.v290 ? JSON.parse(JSON.stringify(pending.v290)) : null;
  v290BaseUndoOneMove();
  if (extra) {
    v290BlueDropped = extra.blueDropped;
    v290BlueSecuredOwner = extra.blueSecuredOwner;
    v290RainRightOwner = extra.rainRightOwner;
    v290RainDeclared = extra.rainDeclared;
    v290RainPending = extra.rainPending;
    v290RainActivated = extra.rainActivated;
    v290NormalPlacementHistory = extra.normalPlacementHistory || [];
  }
  renderBoard();
};

function updateStatusPanel() {
  emptyCount = countEmptyCells();
  const isCurrentStarter = currentPlayer === startingPlayer;
  document.getElementById('current-player').innerText = `${isCurrentStarter ? '先手' : '後手'} (${currentPlayer === 'white' ? '白' : '黒'})`;
  document.getElementById('turn-count').innerText = turnNumber;
  document.getElementById('empty-count').innerText = emptyCount;
  document.getElementById('score-p1').innerText = `${playerScores.white} pt`;
  document.getElementById('score-p2').innerText = `${playerScores.black} pt`;
  document.getElementById('wall-p1').innerText = wallCount.white;
  document.getElementById('wall-p2').innerText = wallCount.black;

  const rainOwner = v290RainRightOwner === 'white' ? '白' : v290RainRightOwner === 'black' ? '黒' : 'なし';
  const rainState = v290RainActivated ? '発動済み' : v290RainPending ? '次ターン発動' : v290RainDeclared ? '宣言済み' : '未使用';
  const rainStatus = document.getElementById('rain-status');
  if (rainStatus) rainStatus.innerText = `${rainOwner} / ${rainState}`;

  const gasStatus = document.getElementById('slide-lock-status');
  if (gamePhase === 'setup') gasStatus.innerText = '準備フェーズ';
  else if (v290RainActivated) gasStatus.innerText = '雨発動・Gas停止';
  else if (gasPhaseActive) gasStatus.innerText = 'Gas Phase';
  else gasStatus.innerText = `Gasまで残り${Math.max(0, V290_GAS_TURN - turnNumber)}T`;

  const instruction = document.getElementById('phase-instruction');
  if (gamePhase === 'setup') instruction.innerText = '【準備フェーズ】四隅ブロックに初期石を配置';
  else if (gamePhase === 'place') instruction.innerText = '【配置フェーズ】通常石または赤石を選択';
  else if (gamePhase === 'slide') instruction.innerText = '【スライドフェーズ】SlideまたはPASS';
  else if (gamePhase === 'gameover') instruction.innerText = '【終局】';

  const rainBtn = document.getElementById('btn-rain');
  if (rainBtn) {
    rainBtn.disabled = !v290CanCallRain();
    if (v290RainActivated) rainBtn.innerText = '雨：発動済み';
    else if (v290RainPending) rainBtn.innerText = '雨：次ターン発動';
    else rainBtn.innerText = '雨を呼ぶ';
  }

  const seasonInfo = document.getElementById('season-info');
  if (seasonInfo) seasonInfo.innerText = 'Blue:99T / Gas:104T / Rain:Blue確保者';
  updateUndoButton();
}

window.v290DebugState = function() {
  return {
    turnNumber,
    gamePhase,
    gasPhaseActive,
    blueDropped: v290BlueDropped,
    blueSecuredOwner: v290BlueSecuredOwner,
    rainRightOwner: v290RainRightOwner,
    rainDeclared: v290RainDeclared,
    rainPending: v290RainPending,
    rainActivated: v290RainActivated,
    normalPlacementHistory: v290NormalPlacementHistory.map(x => ({ ...x }))
  };
};

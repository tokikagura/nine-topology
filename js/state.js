  let board = Array.from({length: 9}, () => Array(9).fill(null));
  let emptyCount = 81;
  let wallCount = { white: 5, black: 5 };
  let playerScores = { white: 0, black: 0 };
  let slideLockedBlocks = [];
  // v2.5正式版: 白を先手、黒を後手に固定。AIは対局ごとに各スロットへセットする。
  const startingPlayer = 'white';
  let currentPlayer = startingPlayer;
  let gamePhase = 'setup';
  let setupCount = 0;
  let isWallDeclarationActive = false;

  // 赤石（絶対障壁）予約リスト: [{ b, c, dueTurn, player }]
  let redReservations = [];

  const SEASON_DROP_TURN = 5;
  let blueStoneDropped = false;
  let gasPhaseActive = false;

  let ntpnMoveHistory = [];
  let boardSnapshots = [];
  let undoHistory = [];
  let currentTurnMove = { place: null, slide: null, event: null };
  let turnNumber = 1;
  let diagnosticContext = 'SYSTEM';
  let botStepSerial = 0;
  let externalDuelAutoStarted = false;
  const DECISIVE_CAPTURE_THRESHOLD = 15;
  const MAX_TURNS = 128; // 大差がつかなくても128ターン終了時に得点判定
  let gameEndInfo = {
    winner: 'IN_PROGRESS',
    reason: 'IN_PROGRESS',
    turns: null,
    detail: ''
  };

  const CORNER_BLOCKS = [0, 2, 6, 8];
  const CELL_NAMES = ["a1", "b1", "c1", "a2", "b2", "c2", "a3", "b3", "c3"];

  window.onload = function() { initGame(); };

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

    blueStoneDropped = false;
    gasPhaseActive = false;
    gameEndInfo = {
      winner: 'IN_PROGRESS',
      reason: 'IN_PROGRESS',
      turns: null,
      detail: ''
    };
    board[2][4] = 'blue-reserved'; // B3-b2

    ntpnMoveHistory = [];
    boardSnapshots = [];
    undoHistory = [];
    saveBoardSnapshot();

    currentTurnMove = { place: null, slide: null, event: null };
    turnNumber = 1;

    const logPanel = document.getElementById('log-panel');
    if (logPanel) logPanel.innerHTML = '';

    logMessage('システム起動 v2.7.2 準備完了。白先手・黒後手固定。コウ判定・ガス中立化ルール有効。');
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

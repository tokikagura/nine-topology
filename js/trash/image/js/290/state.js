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

  const BLUE_SHIELD_PER_STONE = 5;
  const BLUE_DROP_EVENTS = [
    { id: 'B1', block: 0, cell: 8, turn: 0, initial: true },
    { id: 'B9', block: 8, cell: 0, turn: 12, initial: false },
    { id: 'B5', block: 4, cell: 4, turn: 50, initial: false }
  ];
  let blueDropState = { B1: true, B9: false, B5: false };
  let blueProtectionRemaining = { white: 0, black: 0 };
  let blueStonesSecured = { white: 0, black: 0 };
  // 青石で一度守られた石は、以後のガスフェーズでも免疫を維持する。
  // 盤面と同じ9ブロック×9セルで、保護済みの石にはスライド追従させる。
  let gasProtectedBoard = Array.from({length: 9}, () => Array(9).fill(false));
  let gasPhaseActive = false;

  let ntpnSetupHistory = [];
  let ntpnMoveHistory = [];
  let ntpnSystemEvents = [];
  let boardSnapshots = [];
  let undoHistory = [];
  let currentTurnMove = { place: null, slide: null, event: null };
  let turnNumber = 1;
  let diagnosticContext = 'SYSTEM';
  let botStepSerial = 0;
  let externalDuelAutoStarted = false;
  let externalEngineLastError = null;
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


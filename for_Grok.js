/**
 * Nine Topology 基本シミュレーション関数
 *
 * board形式:
 * board[0] ～ board[8] = B1 ～ B9
 * 各ブロックは9セル:
 * [a1,b1,c1,a2,b2,c2,a3,b3,c3]
 */

const NT_DIRS = ["up", "down", "left", "right"];

function cloneBoard(board) {
  return board.map(block => block.slice());
}

/**
 * 9個の3×3ブロックを、連続した9×9盤面へ変換
 */
function boardToGrid(board) {
  const grid = Array.from(
    { length: 9 },
    () => Array(9).fill(null)
  );

  for (let b = 0; b < 9; b++) {
    for (let c = 0; c < 9; c++) {
      const row =
        Math.floor(b / 3) * 3 +
        Math.floor(c / 3);

      const col =
        (b % 3) * 3 +
        (c % 3);

      grid[row][col] = board[b][c];
    }
  }

  return grid;
}

/**
 * 9×9盤面を9個の3×3ブロックへ戻す
 */
function gridToBoard(grid) {
  const board = Array.from(
    { length: 9 },
    () => Array(9).fill(null)
  );

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const b =
        Math.floor(row / 3) * 3 +
        Math.floor(col / 3);

      const c =
        (row % 3) * 3 +
        (col % 3);

      board[b][c] = grid[row][col];
    }
  }

  return board;
}

/**
 * 同色連結群と呼吸点を取得
 * ブロック境界を越えて上下左右につながる
 */
function getGroupInfo(grid, startRow, startCol) {
  const stone = grid[startRow][startCol];

  if (
    stone === null ||
    stone === "red" ||
    stone === "blue-reserved"
  ) {
    return {
      stone,
      stones: [],
      liberties: 99
    };
  }

  const visited = Array.from(
    { length: 9 },
    () => Array(9).fill(false)
  );

  const queue = [[startRow, startCol]];
  const stones = [];
  const liberties = new Set();

  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  visited[startRow][startCol] = true;

  while (queue.length > 0) {
    const [row, col] = queue.shift();
    stones.push({ row, col });

    for (const [dr, dc] of directions) {
      const nextRow = row + dr;
      const nextCol = col + dc;

      if (
        nextRow < 0 ||
        nextRow >= 9 ||
        nextCol < 0 ||
        nextCol >= 9
      ) {
        continue;
      }

      const neighbor = grid[nextRow][nextCol];

      if (neighbor === null) {
        liberties.add(`${nextRow},${nextCol}`);
      } else if (
        neighbor === stone &&
        !visited[nextRow][nextCol]
      ) {
        visited[nextRow][nextCol] = true;
        queue.push([nextRow, nextCol]);
      }
    }
  }

  return {
    stone,
    stones,
    liberties: liberties.size
  };
}

/**
 * 呼吸点0の群を同時捕獲
 */
function resolveCaptures(board) {
  const grid = boardToGrid(board);

  const checked = Array.from(
    { length: 9 },
    () => Array(9).fill(false)
  );

  const captured = {
    white: 0,
    black: 0,
    blue: 0
  };

  const capturedGroups = [];

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const stone = grid[row][col];

      if (
        !["white", "black", "blue"].includes(stone) ||
        checked[row][col]
      ) {
        continue;
      }

      const group = getGroupInfo(grid, row, col);

      for (const pos of group.stones) {
        checked[pos.row][pos.col] = true;
      }

      if (group.liberties === 0) {
        captured[stone] += group.stones.length;
        capturedGroups.push(group);
      }
    }
  }

  // 全群の判定後にまとめて削除
  for (const group of capturedGroups) {
    for (const pos of group.stones) {
      grid[pos.row][pos.col] = null;
    }
  }

  return {
    board: gridToBoard(grid),
    captured,
    groups: capturedGroups
  };
}

/**
 * 3×3ブロック内部を循環スライド
 *
 * right:
 * 各横列を右へ1マス
 *
 * left:
 * 各横列を左へ1マス
 *
 * up:
 * 各縦列を上へ1マス
 *
 * down:
 * 各縦列を下へ1マス
 */
function slideBlock(board, blockIndex, direction) {
  const next = cloneBoard(board);
  const block = next[blockIndex];

  if (!block || !NT_DIRS.includes(direction)) {
    throw new Error("Invalid slide");
  }

  if (direction === "right") {
    [block[0], block[1], block[2]] =
      [block[2], block[0], block[1]];

    [block[3], block[4], block[5]] =
      [block[5], block[3], block[4]];

    [block[6], block[7], block[8]] =
      [block[8], block[6], block[7]];
  }

  if (direction === "left") {
    [block[0], block[1], block[2]] =
      [block[1], block[2], block[0]];

    [block[3], block[4], block[5]] =
      [block[4], block[5], block[3]];

    [block[6], block[7], block[8]] =
      [block[7], block[8], block[6]];
  }

  if (direction === "down") {
    [block[0], block[3], block[6]] =
      [block[6], block[0], block[3]];

    [block[1], block[4], block[7]] =
      [block[7], block[1], block[4]];

    [block[2], block[5], block[8]] =
      [block[8], block[2], block[5]];
  }

  if (direction === "up") {
    [block[0], block[3], block[6]] =
      [block[3], block[6], block[0]];

    [block[1], block[4], block[7]] =
      [block[4], block[7], block[1]];

    [block[2], block[5], block[8]] =
      [block[5], block[8], block[2]];
  }

  return resolveCaptures(next);
}

/**
 * 配置後の盤面を仮想計算
 */
function simulatePlace(board, player, b, c) {
  if (!board[b] || board[b][c] !== null) {
    return {
      legal: false,
      reason: "occupied"
    };
  }

  const next = cloneBoard(board);
  next[b][c] = player;

  const result = resolveCaptures(next);
  const grid = boardToGrid(result.board);

  const row =
    Math.floor(b / 3) * 3 +
    Math.floor(c / 3);

  const col =
    (b % 3) * 3 +
    (c % 3);

  const selfGroup = getGroupInfo(grid, row, col);

  const opponent =
    player === "white" ? "black" : "white";

  const capturedEnemy =
    result.captured[opponent] || 0;

  // 相手を取れず、自分の呼吸点も0なら自殺手
  if (
    selfGroup.liberties === 0 &&
    capturedEnemy === 0
  ) {
    return {
      legal: false,
      reason: "suicide"
    };
  }

  return {
    legal: true,
    board: result.board,
    captured: result.captured,
    ownGroupSize: selfGroup.stones.length,
    ownLiberties: selfGroup.liberties
  };
}

/**
 * スライド後の盤面を仮想計算
 */
function simulateSlide(
  board,
  blockIndex,
  direction,
  lockedBlocks = []
) {
  if (lockedBlocks.includes(blockIndex)) {
    return {
      legal: false,
      reason: "locked"
    };
  }

  const result = slideBlock(
    board,
    blockIndex,
    direction
  );

  return {
    legal: true,
    board: result.board,
    captured: result.captured,
    groups: result.groups
  };
}
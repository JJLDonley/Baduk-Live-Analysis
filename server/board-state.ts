import { Move } from "./models.ts";

export type BoardCell = -1 | 0 | 1;

export interface BoardReplayResult {
  board: BoardCell[][];
  captures: { black: number; white: number };
  errors: string[];
}

type Point = [number, number];

function createBoard(size: number): BoardCell[][] {
  return Array.from({ length: size }, () => Array<BoardCell>(size).fill(0));
}

function colorToCell(color: "black" | "white"): BoardCell {
  return color === "black" ? 1 : -1;
}

function opponent(cell: BoardCell): BoardCell {
  return cell === 1 ? -1 : 1;
}

function inBounds(board: BoardCell[][], x: number, y: number): boolean {
  return y >= 0 && y < board.length && x >= 0 && x < board[0].length;
}

function neighbors(board: BoardCell[][], x: number, y: number): Point[] {
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([nx, ny]) =>
    inBounds(board, nx, ny)
  ) as Point[];
}

function groupAt(board: BoardCell[][], x: number, y: number): Point[] {
  const color = board[y][x];
  if (color === 0) return [];

  const group: Point[] = [];
  const seen = new Set<string>();
  const stack: Point[] = [[x, y]];

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    const key = `${cx},${cy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    group.push([cx, cy]);

    for (const [nx, ny] of neighbors(board, cx, cy)) {
      if (board[ny][nx] === color && !seen.has(`${nx},${ny}`)) {
        stack.push([nx, ny]);
      }
    }
  }

  return group;
}

function hasLiberty(board: BoardCell[][], group: Point[]): boolean {
  return group.some(([x, y]) =>
    neighbors(board, x, y).some(([nx, ny]) => board[ny][nx] === 0)
  );
}

function removeGroup(board: BoardCell[][], group: Point[]): void {
  for (const [x, y] of group) {
    board[y][x] = 0;
  }
}

export function replayMoves(moves: Move[], boardSize = 19): BoardReplayResult {
  const board = createBoard(boardSize);
  const captures = { black: 0, white: 0 };
  const errors: string[] = [];

  for (const move of moves) {
    if (move.move === "pass") continue;
    if (!move.coordinates) {
      errors.push(`Move ${move.moveNumber} has no coordinates`);
      continue;
    }

    const [x, y] = move.coordinates;
    if (!inBounds(board, x, y)) {
      errors.push(`Move ${move.moveNumber} is out of bounds: ${x},${y}`);
      continue;
    }
    if (board[y][x] !== 0) {
      errors.push(`Move ${move.moveNumber} is occupied: ${x},${y}`);
      continue;
    }

    const placed = colorToCell(move.color);
    const enemy = opponent(placed);
    board[y][x] = placed;

    let captured = 0;
    const checkedEnemyGroups = new Set<string>();
    for (const [nx, ny] of neighbors(board, x, y)) {
      if (board[ny][nx] !== enemy) continue;
      const group = groupAt(board, nx, ny);
      const groupKey = group.map(([gx, gy]) => `${gx},${gy}`).sort().join(";");
      if (checkedEnemyGroups.has(groupKey)) continue;
      checkedEnemyGroups.add(groupKey);
      if (!hasLiberty(board, group)) {
        captured += group.length;
        removeGroup(board, group);
      }
    }

    const ownGroup = groupAt(board, x, y);
    if (!hasLiberty(board, ownGroup)) {
      removeGroup(board, ownGroup);
      errors.push(`Move ${move.moveNumber} is suicide: ${x},${y}`);
      continue;
    }

    if (captured > 0) {
      captures[move.color] += captured;
    }
  }

  return { board, captures, errors };
}

import type { Game } from "./types";
import { SnakeGame } from "./snake";
import { Game2048 } from "./game2048";
import { BreakoutGame } from "./breakout";
import { TetrominoGame } from "./tetromino";
import { PongGame } from "./pong";
import { MinesweeperGame } from "./minesweeper";
import { ChessGame } from "./chess";

export const GAMES: Game[] = [
  new SnakeGame(),
  new Game2048(),
  new BreakoutGame(),
  new TetrominoGame(),
  new PongGame(),
  new MinesweeperGame(),
  new ChessGame(),
];

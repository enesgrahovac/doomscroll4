import { GremlinState } from "./types";
import { TOKENS } from "./tokens";

type TokensType = typeof TOKENS;

// 16x16 pixel art grids
// 0 = transparent, 1 = body (dark), 2 = accent (eyes/highlights), 3 = border/outline, 4 = mouth
const IDLE_SPRITE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 0],
  [0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0],
  [0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0],
  [0, 0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0, 0],
  [0, 0, 3, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 3, 0, 0],
  [0, 0, 3, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 3, 0, 0],
  [0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0],
  [0, 0, 3, 1, 1, 1, 4, 4, 4, 4, 1, 1, 1, 3, 0, 0],
  [0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0],
  [0, 0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0, 0],
  [0, 0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0, 0],
  [0, 0, 0, 0, 3, 1, 3, 0, 0, 3, 1, 3, 0, 0, 0, 0],
  [0, 0, 0, 0, 3, 1, 3, 0, 0, 3, 1, 3, 0, 0, 0, 0],
  [0, 0, 0, 0, 3, 3, 3, 0, 0, 3, 3, 3, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const EATING_SPRITE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 3, 3, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 0],
  [0, 0, 0, 0, 3, 3, 0, 0, 0, 0, 3, 3, 0, 0, 0, 0],
  [0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0],
  [0, 0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0, 0],
  [0, 0, 3, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 3, 0, 0],
  [0, 0, 3, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 3, 0, 0],
  [0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0],
  [0, 0, 3, 1, 1, 4, 4, 4, 4, 4, 4, 1, 1, 3, 0, 0],
  [0, 0, 3, 1, 1, 4, 1, 1, 1, 1, 4, 1, 1, 3, 0, 0],
  [0, 0, 0, 3, 1, 4, 4, 4, 4, 4, 4, 1, 3, 0, 0, 0],
  [0, 0, 0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 3, 0, 0, 0],
  [0, 0, 0, 0, 3, 1, 3, 0, 0, 3, 1, 3, 0, 0, 0, 0],
  [0, 0, 0, 0, 3, 1, 3, 0, 0, 3, 1, 3, 0, 0, 0, 0],
  [0, 0, 0, 0, 3, 3, 3, 0, 0, 3, 3, 3, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

function getSprite(state: GremlinState): number[][] {
  switch (state) {
    case "eating":
      return EATING_SPRITE;
    case "idle":
    case "hungry":
    case "satisfied":
    case "angry":
    default:
      return IDLE_SPRITE;
  }
}

function getPixelColor(value: number, tokens: TokensType): string | null {
  switch (value) {
    case 0:
      return null; // transparent
    case 1:
      return tokens.bgRaise2; // body
    case 2:
      return tokens.accent; // eyes
    case 3:
      return tokens.borderBright; // outline
    case 4:
      return tokens.textDim; // mouth
    default:
      return null;
  }
}

export function drawGremlin(
  canvas: HTMLCanvasElement,
  state: GremlinState,
  tokens: TokensType
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const px = Math.floor(canvas.width / 16);
  const sprite = getSprite(state);

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const color = getPixelColor(sprite[y][x], tokens);
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * px, y * px, px, px);
      }
    }
  }
}

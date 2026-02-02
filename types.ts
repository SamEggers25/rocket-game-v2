
export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface RocketState {
  position: Vector2;
  velocity: number; // Vertical only for this top-down runner
  width: number;
  height: number;
}

export interface Asteroid {
  id: string;
  position: Vector2;
  radius: number;
  speed: number;
  verticalDrift: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  seed: number; // For procedural jaggedness
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

export interface MissionUpdate {
  text: string;
  type: 'info' | 'warning' | 'danger';
  timestamp: number;
}

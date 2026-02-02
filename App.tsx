
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameStatus, RocketState, Asteroid, Star, MissionUpdate, Particle } from './types';
import { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  ROCKET_WIDTH, 
  ROCKET_HEIGHT, 
  ROCKET_ACCELERATION,
  ROCKET_FRICTION,
  ROCKET_MAX_SPEED,
  INITIAL_ASTEROID_SPEED,
  INITIAL_SPAWN_RATE,
  LEVEL_DURATION_MS,
  SCORE_PER_SECOND,
  COLORS
} from './constants';
import { getMissionControlCommentary } from './services/geminiService';
import { Rocket, Play, RotateCcw, ShieldAlert, Cpu, Layers } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('highScore')) || 0);
  const [level, setLevel] = useState(1);
  const [missionLog, setMissionLog] = useState<MissionUpdate[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rocketRef = useRef<RocketState>({
    position: { x: 120, y: GAME_HEIGHT / 2 },
    velocity: 0,
    width: ROCKET_WIDTH,
    height: ROCKET_HEIGHT,
  });
  
  const asteroidsRef = useRef<Asteroid[]>([]);
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lastAsteroidSpawnRef = useRef<number>(0);

  // Initialize Parallax Stars
  useEffect(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 200; i++) {
      const depth = Math.random();
      stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: depth * 2 + 0.5,
        speed: depth * 3 + 0.5,
        opacity: 0.3 + depth * 0.7
      });
    }
    starsRef.current = stars;
  }, []);

  const addMissionUpdate = useCallback((text: string, type: 'info' | 'warning' | 'danger' = 'info') => {
    setMissionLog(prev => [{ text, type, timestamp: Date.now() }, ...prev.slice(0, 4)]);
  }, []);

  const handleGeminiCommentary = useCallback(async (currentScore: number, gameStatus: 'playing' | 'gameover') => {
    setIsAiLoading(true);
    const msg = await getMissionControlCommentary(currentScore, gameStatus);
    addMissionUpdate(msg, gameStatus === 'gameover' ? 'danger' : 'info');
    setIsAiLoading(false);
  }, [addMissionUpdate]);

  const startGame = () => {
    setStatus(GameStatus.PLAYING);
    setScore(0);
    setLevel(1);
    setMissionLog([]);
    asteroidsRef.current = [];
    particlesRef.current = [];
    rocketRef.current.position = { x: 120, y: GAME_HEIGHT / 2 };
    rocketRef.current.velocity = 0;
    startTimeRef.current = performance.now();
    lastAsteroidSpawnRef.current = performance.now();
    addMissionUpdate("Mission Start. Traversal initiated.", "info");
  };

  const endGame = () => {
    setStatus(GameStatus.GAME_OVER);
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('highScore', score.toString());
    }
    handleGeminiCommentary(score, 'gameover');
  };

  const createExhaustParticle = (x: number, y: number) => {
    particlesRef.current.push({
      x,
      y,
      vx: -Math.random() * 5 - 2,
      vy: (Math.random() - 0.5) * 2,
      life: 1,
      maxLife: Math.random() * 0.5 + 0.5,
      size: Math.random() * 4 + 2,
      color: Math.random() > 0.5 ? COLORS.EXHAUST : '#fbbf24'
    });
  };

  const update = useCallback((time: number) => {
    if (status !== GameStatus.PLAYING) return;

    lastTimeRef.current = time;

    // Time calculations
    const elapsed = time - startTimeRef.current;
    
    // Level calculation
    const currentLevel = Math.floor(elapsed / LEVEL_DURATION_MS) + 1;
    if (currentLevel > level) {
      setLevel(currentLevel);
      setShowLevelUp(true);
      setTimeout(() => setShowLevelUp(false), 2000);
      handleGeminiCommentary(score, 'playing');
    }

    // Scoring: 100 points per second
    const currentScore = Math.floor((elapsed / 1000) * SCORE_PER_SECOND);
    setScore(currentScore);

    // Physics
    const rocket = rocketRef.current;
    if (keysRef.current.has('ArrowUp') || keysRef.current.has('w')) {
      rocket.velocity -= ROCKET_ACCELERATION;
      for(let i=0; i<3; i++) createExhaustParticle(rocket.position.x - 20, rocket.position.y);
    }
    if (keysRef.current.has('ArrowDown') || keysRef.current.has('s')) {
      rocket.velocity += ROCKET_ACCELERATION;
      for(let i=0; i<3; i++) createExhaustParticle(rocket.position.x - 20, rocket.position.y);
    }

    rocket.velocity *= ROCKET_FRICTION;
    if (Math.abs(rocket.velocity) > ROCKET_MAX_SPEED) {
      rocket.velocity = Math.sign(rocket.velocity) * ROCKET_MAX_SPEED;
    }
    rocket.position.y += rocket.velocity;

    // Boundaries
    if (rocket.position.y < rocket.height / 2) {
      rocket.position.y = rocket.height / 2;
      rocket.velocity *= -0.5;
    } else if (rocket.position.y > GAME_HEIGHT - rocket.height / 2) {
      rocket.position.y = GAME_HEIGHT - rocket.height / 2;
      rocket.velocity *= -0.5;
    }

    // Difficulty params based on discrete level
    // Speed increases by level, Spawn rate decreases (gets tighter)
    const speedMultiplier = 1 + (level - 1) * 0.25;
    const spawnRateMultiplier = Math.max(0.3, 1 - (level - 1) * 0.1);
    const currentSpawnRate = INITIAL_SPAWN_RATE * spawnRateMultiplier;

    // Parallax Stars
    starsRef.current.forEach(star => {
      star.x -= star.speed * speedMultiplier * 0.5;
      if (star.x < 0) {
        star.x = GAME_WIDTH;
        star.y = Math.random() * GAME_HEIGHT;
      }
    });

    // Particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
      return p.life > 0;
    });

    // Asteroids logic
    if (time - lastAsteroidSpawnRef.current > currentSpawnRate) {
      const radius = Math.random() * 25 + 15;
      asteroidsRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        position: { x: GAME_WIDTH + radius, y: Math.random() * GAME_HEIGHT },
        radius,
        speed: (INITIAL_ASTEROID_SPEED + Math.random() * 2) * speedMultiplier,
        verticalDrift: (Math.random() - 0.5) * (level > 2 ? level * 0.5 : 0),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        color: COLORS.ASTEROID,
        seed: Math.random()
      });
      lastAsteroidSpawnRef.current = time;
    }

    // Update asteroids and check collision
    const nextAsteroids: Asteroid[] = [];
    for (const ast of asteroidsRef.current) {
      ast.position.x -= ast.speed;
      ast.position.y += ast.verticalDrift;
      ast.rotation += ast.rotationSpeed;

      const distX = Math.abs(rocket.position.x - ast.position.x);
      const distY = Math.abs(rocket.position.y - ast.position.y);
      
      if (distX < (rocket.width / 2 + ast.radius * 0.75) && distY < (rocket.height / 2 + ast.radius * 0.75)) {
        endGame();
        return;
      }

      if (ast.position.x + ast.radius > -100) {
        nextAsteroids.push(ast);
      }
    }
    asteroidsRef.current = nextAsteroids;

    draw();
    requestRef.current = requestAnimationFrame(update);
  }, [status, endGame, level, score]);

  const drawAsteroid = (ctx: CanvasRenderingContext2D, ast: Asteroid) => {
    ctx.save();
    ctx.translate(ast.position.x, ast.position.y);
    ctx.rotate(ast.rotation);
    
    ctx.fillStyle = ast.color;
    ctx.beginPath();
    const sides = 10;
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const noise = Math.sin(ast.seed * 100 + i * 1.5) * 5;
      const r = ast.radius + noise;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.ASTEROID_CRATER;
    const craterCount = Math.floor(ast.radius / 10) + 2;
    for (let i = 0; i < craterCount; i++) {
      const angle = (i / craterCount) * Math.PI * 2 + ast.seed * 5;
      const r = ast.radius * 0.4;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * r, Math.sin(angle) * r, ast.radius * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const bgGrad = ctx.createRadialGradient(GAME_WIDTH/2, GAME_HEIGHT/2, 0, GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    starsRef.current.forEach(star => {
      ctx.globalAlpha = star.opacity;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    const r = rocketRef.current;
    ctx.save();
    ctx.translate(r.position.x, r.position.y);
    ctx.rotate(r.velocity * 0.02);

    const gradient = ctx.createLinearGradient(-r.width/2, 0, r.width/2, 0);
    gradient.addColorStop(0, COLORS.ROCKET_SECONDARY);
    gradient.addColorStop(0.5, COLORS.ROCKET_PRIMARY);
    gradient.addColorStop(1, '#ffffff');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(r.width/2, 0);
    ctx.bezierCurveTo(r.width/2, -r.height/2, -r.width/4, -r.height/2, -r.width/2, -r.height/3);
    ctx.lineTo(-r.width/2, r.height/3);
    ctx.bezierCurveTo(-r.width/4, r.height/2, r.width/2, r.height/2, r.width/2, 0);
    ctx.fill();

    ctx.fillStyle = COLORS.ROCKET_SECONDARY;
    ctx.beginPath();
    ctx.moveTo(-r.width/4, -r.height/2);
    ctx.lineTo(-r.width/2, -r.height);
    ctx.lineTo(-r.width/2, -r.height/2);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(-r.width/4, r.height/2);
    ctx.lineTo(-r.width/2, r.height);
    ctx.lineTo(-r.width/2, r.height/2);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 10;
    ctx.shadowColor = '#60a5fa';
    ctx.fillStyle = '#93c5fd';
    ctx.beginPath();
    ctx.ellipse(r.width/4, 0, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    asteroidsRef.current.forEach(ast => drawAsteroid(ctx, ast));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.key);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    requestRef.current = requestAnimationFrame(update);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white p-4">
      {/* HUD Header */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-10">
        <div className="flex gap-4">
            <div className="bg-slate-900/80 backdrop-blur border border-blue-500/30 p-4 rounded-xl shadow-2xl flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1">Score Pool</span>
                <span className="text-3xl font-orbitron text-white leading-none">{score.toLocaleString()}</span>
              </div>
              <div className="h-10 w-px bg-blue-500/20" />
              <div className="flex flex-col">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-1">Record</span>
                <span className="text-3xl font-orbitron text-white leading-none">{highScore.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-slate-900/80 backdrop-blur border border-cyan-500/30 p-4 rounded-xl shadow-2xl flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                    <Layers className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Sector Status</span>
                </div>
                <span className="text-xl font-orbitron text-cyan-200">LVL {level}</span>
            </div>
        </div>

        <div className="flex flex-col items-end gap-2 w-64">
           <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-blue-500/30 px-3 py-1 rounded-full">
              <Cpu className={`w-3 h-3 text-cyan-400 ${isAiLoading ? 'animate-spin' : ''}`} />
              <span className="text-[9px] font-bold tracking-widest text-cyan-300 uppercase">AI Comms Active</span>
           </div>
           {missionLog.map((log, idx) => (
             <div 
               key={log.timestamp}
               className={`text-right px-4 py-2 rounded-lg border text-sm transition-all duration-300 transform animate-in slide-in-from-right-10 fade-in
                 ${idx === 0 ? 'scale-100 opacity-100' : 'scale-90 opacity-40'}
                 ${log.type === 'danger' ? 'bg-red-950/40 border-red-500 text-red-200' : 
                   log.type === 'warning' ? 'bg-amber-950/40 border-amber-500 text-amber-200' : 
                   'bg-blue-950/40 border-blue-500 text-blue-100'}`}
             >
               {log.text}
             </div>
           ))}
        </div>
      </div>

      {/* Main Canvas Container */}
      <div className="relative rounded-2xl overflow-hidden border-4 border-slate-800 shadow-[0_0_80px_rgba(59,130,246,0.1)] bg-black">
        <canvas 
          ref={canvasRef} 
          width={GAME_WIDTH} 
          height={GAME_HEIGHT}
          className="cursor-none"
        />

        {/* Level Up Flash */}
        {showLevelUp && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 overflow-hidden">
            <div className="text-8xl font-orbitron font-bold italic text-white/20 animate-ping absolute uppercase">
              LEVEL {level}
            </div>
            <div className="text-6xl font-orbitron font-bold text-cyan-400 animate-in zoom-in duration-500 flex flex-col items-center">
              <span className="text-sm tracking-[1em] mb-2 text-cyan-200 opacity-50 uppercase">Entering Sector</span>
              LEVEL {level}
            </div>
          </div>
        )}

        {/* Start Overlay */}
        {status === GameStatus.START && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
            <div className="mb-6 bg-blue-500/10 p-6 rounded-full border-2 border-blue-500/20 animate-pulse-slow">
              <Rocket className="w-20 h-20 text-blue-500" />
            </div>
            <h1 className="text-5xl md:text-6xl font-orbitron font-bold mb-4 bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
              STELLAR VOYAGER
            </h1>
            <p className="text-slate-400 max-w-md mb-8 text-lg">
              Sectorized navigation mode active. Survival adds <span className="text-blue-400 font-bold">100 points/sec</span>. 
              Clear sectors to advance.
            </p>
            <button 
              onClick={startGame}
              className="group relative flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-xl font-bold text-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.4)]"
            >
              <Play className="w-7 h-7 fill-current" />
              IGNITE ENGINES
            </button>
          </div>
        )}

        {/* Game Over Overlay */}
        {status === GameStatus.GAME_OVER && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-300">
            <div className="mb-6 bg-red-500/10 p-6 rounded-full border-2 border-red-500/20">
              <ShieldAlert className="w-20 h-20 text-red-500" />
            </div>
            <h2 className="text-5xl font-orbitron font-bold mb-2 text-red-500">HULL BREACH</h2>
            <p className="text-slate-400 mb-8 text-lg">Structural collapse in Level {level}.</p>
            
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-10">
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <span className="block text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Final Score</span>
                <span className="text-4xl font-orbitron">{score.toLocaleString()}</span>
              </div>
              <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                <span className="block text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Best Flight</span>
                <span className="text-4xl font-orbitron text-amber-400">{highScore.toLocaleString()}</span>
              </div>
            </div>

            <button 
              onClick={startGame}
              className="group relative flex items-center gap-3 bg-white text-slate-950 hover:bg-slate-200 px-10 py-5 rounded-xl font-bold text-2xl transition-all hover:scale-105 active:scale-95 shadow-2xl"
            >
              <RotateCcw className="w-7 h-7" />
              RE-IGNITE
            </button>
          </div>
        )}
      </div>

      {/* Footer / Controls Tip */}
      <div className="mt-8 flex gap-12 items-center text-slate-500 text-xs">
        <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
                <kbd className="px-3 py-1 bg-slate-800 rounded border border-slate-700 text-slate-300 font-bold">W</kbd>
                <kbd className="px-3 py-1 bg-slate-800 rounded border border-slate-700 text-slate-300 font-bold">S</kbd>
            </div>
            <span className="uppercase tracking-widest font-bold opacity-60">Vertical Thrust</span>
        </div>
        <div className="h-8 w-px bg-slate-800" />
        <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
                <kbd className="px-3 py-1 bg-slate-800 rounded border border-slate-700 text-slate-300 font-bold">↑</kbd>
                <kbd className="px-3 py-1 bg-slate-800 rounded border border-slate-700 text-slate-300 font-bold">↓</kbd>
            </div>
            <span className="uppercase tracking-widest font-bold opacity-60">Manual Override</span>
        </div>
      </div>
    </div>
  );
};

export default App;

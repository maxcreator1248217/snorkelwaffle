/* =========================================================
   Snorkelwaffle – script.js
   Sections:
   1. Helpers (safe storage, timing, shuffling)
   2. Screen switching (home <-> games)
   3. 3D tilt for the home cards
   4. Game 1: Tic-Tac-Toe
   5. Game 2: Memory Match
   6. Game 3: Snake
   7. Game 4: Reaction Time
   8. Footer year
   ========================================================= */
'use strict';


/* ---------- 1. Helpers ---------- */

// Safe wrapper around localStorage.
// Some browsers block storage (private mode, file:// pages, strict settings),
// so every read and write is inside try/catch and can never crash the site.
const storage = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Storage unavailable: the game still works, the score just isn't saved.
    }
  }
};

// True if the user asked their device for less motion.
const prefersReducedMotion =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Turns 75 into "1:15".
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes + ':' + String(seconds).padStart(2, '0');
}

// Randomly shuffles an array (Fisher–Yates shuffle) and returns it.
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}


/* ---------- 2. Screen switching ----------
   Every screen is a <section class="view">. Only one is visible at a time.
   Each game can register onEnter / onLeave functions in the "games" object
   (for example, Snake pauses itself when you leave). */

const games = {};
let currentView = document.getElementById('home');
let isSwitching = false;

function showView(id) {
  const nextView = document.getElementById(id);
  if (!nextView || nextView === currentView || isSwitching) return;

  isSwitching = true;
  const previousView = currentView;

  // Let the game we are leaving clean up (stop timers, pause, etc.)
  if (games[previousView.id] && games[previousView.id].onLeave) {
    games[previousView.id].onLeave();
  }

  // Step 1: fade the current screen out
  previousView.classList.add('is-fading');
  const fadeTime = prefersReducedMotion ? 0 : 220;

  setTimeout(function () {
    // Step 2: hide the old screen, show the new one (still faded)
    previousView.hidden = true;
    previousView.classList.remove('is-fading');

    nextView.classList.add('is-fading');
    nextView.hidden = false;
    void nextView.offsetWidth; // forces the browser to notice the change so the fade-in animates
    nextView.classList.remove('is-fading');

    currentView = nextView;
    window.scrollTo(0, 0);

    // Move keyboard/screen-reader focus to the new screen's heading
    const heading = nextView.querySelector('h1, h2');
    if (heading) heading.focus({ preventScroll: true });

    if (games[id] && games[id].onEnter) games[id].onEnter();
    isSwitching = false;
  }, fadeTime);
}

// Clicking a game card opens that game (data-game="..." holds the section id)
const gameCards = document.querySelectorAll('.game-card');
gameCards.forEach(function (card) {
  card.addEventListener('click', function () {
    showView(card.dataset.game);
  });
});

// Every "Back to games" button returns home
document.querySelectorAll('.back-btn').forEach(function (button) {
  button.addEventListener('click', function () {
    showView('home');
  });
});

// The logo also returns home
document.getElementById('brand-link').addEventListener('click', function (event) {
  event.preventDefault(); // stop the "#" link from jumping
  showView('home');
});


/* ---------- 3. 3D tilt for the home cards ----------
   When the mouse moves over a card, we work out where it is
   (-0.5 to 0.5 across and down) and rotate the card toward it. */

const MAX_TILT = 10; // degrees

if (!prefersReducedMotion) {
  gameCards.forEach(function (card) {
    card.addEventListener('pointermove', function (event) {
      if (event.pointerType !== 'mouse') return; // only tilt for a real mouse

      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      const rotateY = (x * 2 * MAX_TILT).toFixed(2);  // left/right
      const rotateX = (-y * 2 * MAX_TILT).toFixed(2); // up/down

      card.style.transform =
        'perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg)';
    });

    // Gently return to flat when the mouse leaves
    card.addEventListener('pointerleave', function () {
      card.style.transform = '';
    });
  });
}


/* ---------- 4. Game 1: Tic-Tac-Toe ---------- */
(function ticTacToe() {
  const boardEl = document.getElementById('ttt-board');
  const statusEl = document.getElementById('ttt-status');
  const restartBtn = document.getElementById('ttt-restart');

  // All 8 ways to win (indexes of the 9 squares, numbered 0–8)
  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  let board = [];        // what's in each square: 'X', 'O' or null
  let currentPlayer = 'X';
  let gameOver = false;
  const cells = [];

  // Build the 9 square buttons once
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'ttt-cell';
    cell.setAttribute('aria-label', 'Square ' + (i + 1));
    cell.addEventListener('click', function () {
      playMove(i);
    });
    boardEl.appendChild(cell);
    cells.push(cell);
  }

  function resetGame() {
    board = Array(9).fill(null);
    currentPlayer = 'X';
    gameOver = false;
    cells.forEach(function (cell, i) {
      cell.textContent = '';
      cell.className = 'ttt-cell';
      cell.disabled = false;
      cell.setAttribute('aria-label', 'Square ' + (i + 1));
    });
    statusEl.textContent = "Player X's turn";
  }

  function playMove(index) {
    if (gameOver || board[index]) return; // ignore finished games and taken squares

    board[index] = currentPlayer;
    cells[index].textContent = currentPlayer;
    cells[index].classList.add(currentPlayer === 'X' ? 'is-x' : 'is-o');
    cells[index].setAttribute('aria-label', 'Square ' + (index + 1) + ', ' + currentPlayer);

    const winningLine = findWinningLine();
    if (winningLine) {
      gameOver = true;
      winningLine.forEach(function (i) {
        cells[i].classList.add('is-win');
      });
      statusEl.textContent = 'Player ' + currentPlayer + ' wins! 🎉';
      disableAll();
    } else if (board.every(Boolean)) {
      gameOver = true;
      statusEl.textContent = "It's a draw!";
    } else {
      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      statusEl.textContent = 'Player ' + currentPlayer + "'s turn";
    }
  }

  function findWinningLine() {
    for (const line of WIN_LINES) {
      const a = line[0], b = line[1], c = line[2];
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
    }
    return null;
  }

  function disableAll() {
    cells.forEach(function (cell) {
      cell.disabled = true;
    });
  }

  restartBtn.addEventListener('click', resetGame);
  resetGame();
})();


/* ---------- 5. Game 2: Memory Match ---------- */
(function memoryMatch() {
  const EMOJIS = ['🍎', '🚀', '🐱', '🎸', '🌈', '⚽', '🍕', '🦄']; // 8 pairs = 16 cards
  const BEST_KEY = 'snorkelwaffle.memoryBest';

  const gridEl = document.getElementById('mem-grid');
  const movesEl = document.getElementById('mem-moves');
  const timeEl = document.getElementById('mem-time');
  const bestEl = document.getElementById('mem-best');
  const statusEl = document.getElementById('mem-status');
  const restartBtn = document.getElementById('mem-restart');

  let firstCard = null;   // first card flipped this turn
  let secondCard = null;  // second card flipped this turn
  let locked = false;     // true while two wrong cards are showing
  let moves = 0;
  let matches = 0;
  let seconds = 0;
  let started = false;
  let timerId = null;
  let flipBackId = null;

  // --- Timer ---
  function startTimer() {
    stopTimer();
    timerId = setInterval(function () {
      seconds++;
      timeEl.textContent = formatTime(seconds);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  // --- Best score (fewest moves, then fastest time) ---
  function showBest() {
    const best = storage.get(BEST_KEY, null);
    if (best && typeof best.moves === 'number' && typeof best.time === 'number') {
      bestEl.textContent = best.moves + ' moves · ' + formatTime(best.time);
    } else {
      bestEl.textContent = '–';
    }
  }

  // --- Start a fresh, shuffled game ---
  function newGame() {
    stopTimer();
    clearTimeout(flipBackId);
    firstCard = null;
    secondCard = null;
    locked = false;
    moves = 0;
    matches = 0;
    seconds = 0;
    started = false;
    movesEl.textContent = '0';
    timeEl.textContent = '0:00';
    statusEl.textContent = 'Find all the pairs!';

    gridEl.innerHTML = '';
    shuffle(EMOJIS.concat(EMOJIS)).forEach(function (emoji) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'mem-card';
      card.dataset.emoji = emoji;
      card.setAttribute('aria-label', 'Hidden card');
      // Front = face-down side ("?"), back = the emoji side
      card.innerHTML =
        '<span class="mem-inner">' +
          '<span class="mem-face mem-front" aria-hidden="true">?</span>' +
          '<span class="mem-face mem-back" aria-hidden="true">' + emoji + '</span>' +
        '</span>';
      card.addEventListener('click', function () {
        flipCard(card);
      });
      gridEl.appendChild(card);
    });
  }

  function flipCard(card) {
    // Ignore clicks while waiting, on the same card, or on already-matched cards
    if (locked || card === firstCard || card.classList.contains('is-matched')) return;

    if (!started) {
      started = true;
      startTimer();
    }

    card.classList.add('is-flipped');
    card.setAttribute('aria-label', card.dataset.emoji);

    if (!firstCard) {
      firstCard = card;
      return;
    }

    secondCard = card;
    moves++;
    movesEl.textContent = moves;
    checkForMatch();
  }

  function checkForMatch() {
    const a = firstCard;
    const b = secondCard;
    firstCard = null;
    secondCard = null;

    if (a.dataset.emoji === b.dataset.emoji) {
      // It's a pair! Keep them face up.
      a.classList.add('is-matched');
      b.classList.add('is-matched');
      matches++;
      if (matches === EMOJIS.length) winGame();
    } else {
      // Not a pair: show them briefly, then flip both back.
      locked = true;
      flipBackId = setTimeout(function () {
        a.classList.remove('is-flipped');
        b.classList.remove('is-flipped');
        a.setAttribute('aria-label', 'Hidden card');
        b.setAttribute('aria-label', 'Hidden card');
        locked = false;
      }, 900);
    }
  }

  function winGame() {
    stopTimer();
    const best = storage.get(BEST_KEY, null);
    const isNewBest =
      !best ||
      typeof best.moves !== 'number' ||
      moves < best.moves ||
      (moves === best.moves && seconds < best.time);

    if (isNewBest) {
      storage.set(BEST_KEY, { moves: moves, time: seconds });
      statusEl.textContent = '🏆 New best! ' + moves + ' moves in ' + formatTime(seconds);
    } else {
      statusEl.textContent = '🎉 You did it in ' + moves + ' moves and ' + formatTime(seconds) + '!';
    }
    showBest();
  }

  // Pause the timer while you're on another screen, resume when you come back
  games.memory = {
    onLeave: stopTimer,
    onEnter: function () {
      if (started && matches < EMOJIS.length) startTimer();
    }
  };

  restartBtn.addEventListener('click', newGame);
  showBest();
  newGame();
})();


/* ---------- 6. Game 3: Snake ---------- */
(function snakeGame() {
  const canvas = document.getElementById('snake-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('snake-score');
  const highEl = document.getElementById('snake-high');
  const overlayEl = document.getElementById('snake-overlay');
  const overlayTitle = document.getElementById('snake-overlay-title');
  const overlayText = document.getElementById('snake-overlay-text');
  const startBtn = document.getElementById('snake-start');

  const GRID = 20;                     // the board is 20 x 20 squares
  const CELL = canvas.width / GRID;    // size of one square in pixels
  const SPEED_MS = 120;                // lower = faster snake
  const HIGH_KEY = 'snorkelwaffle.snakeHigh';

  const DIRECTIONS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1,  y: 0 }
  };

  let snake = [];          // list of {x, y} squares, head first
  let direction = DIRECTIONS.right;
  let directionQueue = []; // queued turns, so quick key presses aren't lost
  let food = null;
  let score = 0;
  let highScore = Number(storage.get(HIGH_KEY, 0)) || 0;
  let loopId = null;
  let state = 'ready';     // 'ready' | 'running' | 'paused' | 'over'

  // --- Setup ---
  function resetGame() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    direction = DIRECTIONS.right;
    directionQueue = [];
    score = 0;
    placeFood();
    updateScores();
    draw();
  }

  // Put food on a random empty square
  function placeFood() {
    const free = [];
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        const taken = snake.some(function (part) { return part.x === x && part.y === y; });
        if (!taken) free.push({ x: x, y: y });
      }
    }
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function updateScores() {
    scoreEl.textContent = score;
    highEl.textContent = highScore;
  }

  // --- Overlay messages ---
  function showOverlay(title, text) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayEl.hidden = false;
  }

  function hideOverlay() {
    overlayEl.hidden = true;
  }

  // --- Start / pause / game over ---
  function start() {
    if (state === 'running') return;
    if (state === 'over') resetGame();
    state = 'running';
    hideOverlay();
    startBtn.textContent = 'Pause';
    clearInterval(loopId);
    loopId = setInterval(tick, SPEED_MS);
  }

  function pause() {
    if (state !== 'running') return;
    state = 'paused';
    clearInterval(loopId);
    showOverlay('Paused', 'Press Resume or Space to keep going.');
    startBtn.textContent = 'Resume';
  }

  function endGame(title) {
    state = 'over';
    clearInterval(loopId);
    if (score > highScore) {
      highScore = score;
      storage.set(HIGH_KEY, highScore);
      title = '🏆 New high score!';
    }
    updateScores();
    showOverlay(title, 'Score: ' + score + '. Press Play again or an arrow key.');
    startBtn.textContent = 'Play again';
  }

  // --- One step of the game ---
  function tick() {
    if (directionQueue.length) direction = directionQueue.shift();

    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const eats = food && head.x === food.x && head.y === food.y;

    // The tail moves out of the way this step unless we're eating
    const body = eats ? snake : snake.slice(0, -1);
    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    const hitSelf = body.some(function (part) { return part.x === head.x && part.y === head.y; });

    if (hitWall || hitSelf) {
      endGame('Game over');
      return;
    }

    snake.unshift(head); // add the new head
    if (eats) {
      score++;
      updateScores();
      placeFood();
      if (!food) {       // the snake fills the whole board
        draw();
        endGame('You win! 🎉');
        return;
      }
    } else {
      snake.pop();       // remove the tail so the length stays the same
    }
    draw();
  }

  // --- Turning ---
  function turn(name) {
    if (state !== 'running') start();

    const next = DIRECTIONS[name];
    const last = directionQueue.length ? directionQueue[directionQueue.length - 1] : direction;
    const isReverse = next.x === -last.x && next.y === -last.y;
    const isSame = next.x === last.x && next.y === last.y;
    if (isReverse || isSame) return;         // can't turn straight back into yourself
    if (directionQueue.length < 2) directionQueue.push(next);
  }

  // --- Drawing on the canvas ---
  function draw() {
    // Checkerboard background
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#fafaf8' : '#f2f2ee';
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    // Food: a red circle
    if (food) {
      ctx.fillStyle = '#e5534b';
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }

    // Snake: accent-colored squares, darker head
    snake.forEach(function (part, i) {
      ctx.fillStyle = i === 0 ? '#3a55d6' : '#4f6bed';
      ctx.fillRect(part.x * CELL + 1, part.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }

  // --- Controls: keyboard (only while the Snake screen is open) ---
  const KEY_TO_DIRECTION = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right'
  };

  document.addEventListener('keydown', function (event) {
    if (currentView.id !== 'snake') return;

    if (KEY_TO_DIRECTION[event.key]) {
      event.preventDefault(); // stop arrow keys from scrolling the page
      turn(KEY_TO_DIRECTION[event.key]);
    } else if (event.key === ' ' || event.code === 'Space') {
      // If a button is focused, Space already "clicks" it, so don't double up
      if (event.target.tagName === 'BUTTON') return;
      event.preventDefault();
      state === 'running' ? pause() : start();
    }
  });

  // --- Controls: on-screen arrows (pointerdown reacts instantly on touch) ---
  document.querySelectorAll('.dpad-btn').forEach(function (button) {
    button.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      turn(button.dataset.dir);
    });
  });

  startBtn.addEventListener('click', function () {
    state === 'running' ? pause() : start();
  });

  // Pause automatically when leaving the Snake screen
  games.snake = {
    onLeave: pause,
    onEnter: draw
  };

  resetGame();
})();


/* ---------- 7. Game 4: Reaction Time ---------- */
(function reactionTime() {
  const BEST_KEY = 'snorkelwaffle.reactionBest';

  const box = document.getElementById('react-box');
  const titleEl = document.getElementById('react-title');
  const subEl = document.getElementById('react-sub');
  const lastEl = document.getElementById('react-last');
  const bestEl = document.getElementById('react-best');

  let state = 'idle';  // 'idle' | 'waiting' | 'go' | 'result' | 'early'
  let timeoutId = null;
  let goTime = 0;
  let best = Number(storage.get(BEST_KEY, 0)) || null;

  function setBox(className, title, subtitle) {
    box.className = 'reaction-box ' + className;
    titleEl.textContent = title;
    subEl.textContent = subtitle;
  }

  function showBest() {
    bestEl.textContent = best ? best + ' ms' : '–';
  }

  // Start a round: wait a random 1.5–4 seconds, then turn green
  function startRound() {
    state = 'waiting';
    setBox('is-waiting', 'Wait for green…', 'Get ready.');
    const delay = 1500 + Math.random() * 2500;
    timeoutId = setTimeout(function () {
      state = 'go';
      goTime = performance.now();
      setBox('is-go', 'Click!', 'Now!');
    }, delay);
  }

  // Called on every click / tap / key press on the box
  function handlePress() {
    if (state === 'waiting') {
      // Clicked before it turned green
      clearTimeout(timeoutId);
      state = 'early';
      setBox('is-early', 'Too soon!', 'Wait for green. Click to try again.');
    } else if (state === 'go') {
      const ms = Math.round(performance.now() - goTime);
      state = 'result';
      lastEl.textContent = ms + ' ms';
      let message = 'Click to try again.';
      if (!best || ms < best) {
        best = ms;
        storage.set(BEST_KEY, best);
        message = '🏆 New best! Click to try again.';
      }
      showBest();
      setBox('', ms + ' ms', message);
    } else {
      // idle, result or early: start a new round
      startRound();
    }
  }

  // pointerdown fires the instant you press (faster and fairer than "click")
  box.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) return; // left mouse button / finger only
    handlePress();
  });

  // Keyboard support: Space or Enter while the box is focused
  box.addEventListener('keydown', function (event) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) handlePress();
    }
  });

  function reset() {
    clearTimeout(timeoutId);
    state = 'idle';
    setBox('', 'Click to start', 'When the box turns green, click as fast as you can.');
  }

  // Cancel any running round when leaving the screen
  games.reaction = { onLeave: reset };

  showBest();
})();


/* ---------- 8. Footer year ---------- */
document.getElementById('year').textContent = new Date().getFullYear();

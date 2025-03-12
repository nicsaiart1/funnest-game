document.addEventListener('DOMContentLoaded', () => {
    // Game elements
    const introScreen = document.getElementById('intro-screen');
    const gameScreen = document.getElementById('game-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const startButton = document.getElementById('start-button');
    const restartButton = document.getElementById('restart-button');
    const scoreElement = document.getElementById('score');
    const timeElement = document.getElementById('time');
    const livesElement = document.getElementById('lives');
    const finalScoreElement = document.getElementById('final-score');
    const highScoreElement = document.getElementById('high-score');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // Game state variables
    let gameActive = false;
    let score = 0;
    let lives = 3;
    let timeRemaining = 60;
    let targets = [];
    let animationFrameId;
    let lastTimestamp = 0;
    let highScore = localStorage.getItem('highScore') || 0;
    let gameTimer;
    let difficultyLevel = 1;
    let targetAppearInterval;
    
    // Game settings
    const targetMinRadius = 20;
    const targetMaxRadius = 50;
    const targetMinLifetime = 1000; // ms
    const targetMaxLifetime = 3000; // ms
    const targetColors = ['#FF5252', '#FF4081', '#7C4DFF', '#536DFE', '#448AFF', '#40C4FF', '#18FFFF', '#64FFDA', '#69F0AE', '#B2FF59', '#EEFF41', '#FFFF00', '#FFD740', '#FFAB40', '#FF6E40'];
    
    // Initialize the game
    function init() {
        // Set up canvas size
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Set up event listeners
        startButton.addEventListener('click', startGame);
        restartButton.addEventListener('click', restartGame);
        
        // Event listeners for both mouse and touch
        canvas.addEventListener('mousedown', handleTargetHit);
        canvas.addEventListener('touchstart', handleTargetHit, { passive: false });
        
        // Display high score
        highScoreElement.textContent = highScore;
    }
    
    // Resize canvas to fit container
    function resizeCanvas() {
        const container = gameScreen;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }
    
    // Start the game
    function startGame() {
        introScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        gameOverScreen.style.display = 'none';
        
        // Reset game state
        gameActive = true;
        score = 0;
        lives = 3;
        timeRemaining = 60;
        targets = [];
        difficultyLevel = 1;
        
        // Update display
        scoreElement.textContent = score;
        livesElement.textContent = lives;
        timeElement.textContent = timeRemaining;
        
        // Start game loop
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        lastTimestamp = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
        
        // Start timer
        gameTimer = setInterval(() => {
            timeRemaining--;
            timeElement.textContent = timeRemaining;
            
            // Increase difficulty every 10 seconds
            if (timeRemaining % 10 === 0 && timeRemaining > 0) {
                difficultyLevel += 0.5;
            }
            
            if (timeRemaining <= 0) {
                endGame();
            }
        }, 1000);
        
        // Start spawning targets
        spawnTarget();
        targetAppearInterval = setInterval(spawnTarget, 1000);
    }
    
    // End the game
    function endGame() {
        gameActive = false;
        clearInterval(gameTimer);
        clearInterval(targetAppearInterval);
        cancelAnimationFrame(animationFrameId);
        
        // Update high score
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('highScore', highScore);
        }
        
        // Display game over screen
        finalScoreElement.textContent = score;
        highScoreElement.textContent = highScore;
        gameScreen.style.display = 'none';
        gameOverScreen.style.display = 'flex';
    }
    
    // Restart the game
    function restartGame() {
        gameOverScreen.style.display = 'none';
        startGame();
    }
    
    // Create a new target
    function spawnTarget() {
        if (!gameActive) return;
        
        // Calculate target properties based on difficulty
        const radius = Math.max(targetMinRadius, targetMaxRadius - (difficultyLevel * 3));
        const lifetime = Math.max(targetMinLifetime, targetMaxLifetime - (difficultyLevel * 200));
        
        const target = {
            x: Math.random() * (canvas.width - radius * 2) + radius,
            y: Math.random() * (canvas.height - radius * 2) + radius,
            radius: radius,
            color: targetColors[Math.floor(Math.random() * targetColors.length)],
            createdAt: performance.now(),
            lifetime: lifetime,
            hit: false,
            points: Math.ceil(difficultyLevel) * (targetMaxRadius - radius + 10)
        };
        
        targets.push(target);
        
        // Spawn additional targets based on difficulty
        if (Math.random() < difficultyLevel * 0.1) {
            setTimeout(spawnTarget, 200);
        }
    }
    
    // Handle target hit (mouse or touch)
    function handleTargetHit(event) {
        event.preventDefault();
        
        if (!gameActive) return;
        
        // Get touch or mouse coordinates
        let x, y;
        if (event.type === 'touchstart') {
            const touch = event.touches[0];
            const rect = canvas.getBoundingClientRect();
            x = touch.clientX - rect.left;
            y = touch.clientY - rect.top;
        } else {
            const rect = canvas.getBoundingClientRect();
            x = event.clientX - rect.left;
            y = event.clientY - rect.top;
        }
        
        // Check if any target was hit
        let targetHit = false;
        for (let i = targets.length - 1; i >= 0; i--) {
            const target = targets[i];
            const distance = Math.sqrt(
                Math.pow(x - target.x, 2) + Math.pow(y - target.y, 2)
            );
            
            if (distance <= target.radius && !target.hit) {
                // Target hit
                target.hit = true;
                targetHit = true;
                
                // Add score based on target size and lifetime
                const timeFactor = 1 - ((performance.now() - target.createdAt) / target.lifetime);
                const pointsEarned = Math.ceil(target.points * (timeFactor + 0.5));
                score += pointsEarned;
                scoreElement.textContent = score;
                
                // Show score popup
                showPointsPopup(target.x, target.y, pointsEarned);
                
                // Remove the target
                setTimeout(() => {
                    const index = targets.indexOf(target);
                    if (index !== -1) {
                        targets.splice(index, 1);
                    }
                }, 100);
                
                // Only count the first hit
                break;
            }
        }
        
        // Penalize misses
        if (!targetHit) {
            lives--;
            livesElement.textContent = lives;
            
            if (lives <= 0) {
                endGame();
            }
        }
    }
    
    // Show points popup when target is hit
    function showPointsPopup(x, y, points) {
        // Create a floating points text on the canvas
        const popup = {
            x: x,
            y: y,
            text: `+${points}`,
            opacity: 1,
            fontSize: 24
        };
        
        // Animate the popup
        const animatePopup = () => {
            ctx.save();
            ctx.fillStyle = `rgba(255, 255, 255, ${popup.opacity})`;
            ctx.font = `bold ${popup.fontSize}px 'Exo 2', sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(popup.text, popup.x, popup.y);
            ctx.restore();
            
            popup.y -= 2;
            popup.opacity -= 0.05;
            
            if (popup.opacity > 0) {
                requestAnimationFrame(animatePopup);
            }
        };
        
        animatePopup();
    }
    
    // Main game loop
    function gameLoop(timestamp) {
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw targets
        for (let i = targets.length - 1; i >= 0; i--) {
            const target = targets[i];
            const elapsedTime = timestamp - target.createdAt;
            
            // Check if target timed out
            if (elapsedTime >= target.lifetime && !target.hit) {
                // Missed target
                targets.splice(i, 1);
                lives--;
                livesElement.textContent = lives;
                
                if (lives <= 0) {
                    endGame();
                    return;
                }
                continue;
            }
            
            // Draw target
            if (!target.hit) {
                // Calculate size based on remaining time
                const timeRatio = 1 - (elapsedTime / target.lifetime);
                const currentRadius = target.radius * (0.5 + (timeRatio * 0.5));
                
                // Draw pulsing target
                ctx.beginPath();
                ctx.arc(target.x, target.y, currentRadius, 0, Math.PI * 2);
                ctx.fillStyle = target.color;
                ctx.fill();
                
                // Draw time indicator
                ctx.beginPath();
                ctx.arc(target.x, target.y, currentRadius, 0, Math.PI * 2 * timeRatio);
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.stroke();
            } else {
                // Draw explosion animation for hit targets
                const explosionProgress = (elapsedTime - (target.lifetime - target.lifetime * (elapsedTime / target.lifetime))) / 200;
                
                if (explosionProgress < 1) {
                    ctx.beginPath();
                    ctx.arc(target.x, target.y, target.radius * (1 + explosionProgress), 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${1 - explosionProgress})`;
                    ctx.fill();
                }
            }
        }
        
        // Continue the game loop
        if (gameActive) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }
    
    // Initialize the game
    init();
});
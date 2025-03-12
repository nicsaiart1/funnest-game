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
    const comboDisplay = document.getElementById('combo-display');
    const comboCountElement = document.getElementById('combo-count');
    const maxComboElement = document.getElementById('max-combo');
    const powerUpDisplay = document.getElementById('power-up-display');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // Game state variables
    let gameActive = false;
    let score = 0;
    let lives = 3;
    let timeRemaining = 60;
    let targets = [];
    let powerUps = [];
    let animationFrameId;
    let lastTimestamp = 0;
    let highScore = localStorage.getItem('highScore') || 0;
    let gameTimer;
    let difficultyLevel = 1;
    let targetAppearInterval;
    let powerUpInterval;
    let comboCount = 0;
    let maxCombo = 0;
    let comboTimer = null;
    let comboMultiplier = 1;
    let lastHitTime = 0;
    
    // Game settings
    const targetMinRadius = 20;
    const targetMaxRadius = 50;
    const targetMinLifetime = 1000; // ms
    const targetMaxLifetime = 3000; // ms
    const targetColors = ['#FF5252', '#FF4081', '#7C4DFF', '#536DFE', '#448AFF', '#40C4FF', '#18FFFF', '#64FFDA', '#69F0AE', '#B2FF59', '#EEFF41', '#FFFF00', '#FFD740', '#FFAB40', '#FF6E40'];
    const comboTimeout = 2000; // ms - time window to maintain combo
    
    // Target types
    const TARGET_TYPES = {
        NORMAL: 'normal',
        MOVING: 'moving',
        SHRINKING: 'shrinking',
        BONUS: 'bonus'
    };
    
    // Power-up types
    const POWER_UP_TYPES = {
        EXTRA_LIFE: 'extraLife',
        TIME_BOOST: 'timeBoost',
        SLOW_TIME: 'slowTime',
        DOUBLE_POINTS: 'doublePoints'
    };
    
    // Power-up settings
    const powerUpColors = {
        [POWER_UP_TYPES.EXTRA_LIFE]: '#FF5252',
        [POWER_UP_TYPES.TIME_BOOST]: '#64FFDA',
        [POWER_UP_TYPES.SLOW_TIME]: '#536DFE',
        [POWER_UP_TYPES.DOUBLE_POINTS]: '#FFFF00'
    };
    
    const powerUpIcons = {
        [POWER_UP_TYPES.EXTRA_LIFE]: '❤️',
        [POWER_UP_TYPES.TIME_BOOST]: '⏱️',
        [POWER_UP_TYPES.SLOW_TIME]: '⏳',
        [POWER_UP_TYPES.DOUBLE_POINTS]: '2️⃣'
    };
    
    // Active power-ups
    let activePowerUps = {
        doublePoints: {
            active: false,
            endTime: 0
        },
        slowTime: {
            active: false,
            endTime: 0
        }
    };
    
    // Initialize the game
    function init() {
        console.log("Init function called");
        
        // Set canvas to a reasonable default size for now
        canvas.width = 800;
        canvas.height = 600;
        
        // Make canvas visible
        canvas.style.display = 'block';
        canvas.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
        
        // Set up event listeners
        window.addEventListener('resize', resizeCanvas);
        startButton.addEventListener('click', startGame);
        restartButton.addEventListener('click', restartGame);
        
        // Event listeners for both mouse and touch
        canvas.addEventListener('mousedown', handleTargetHit);
        canvas.addEventListener('touchstart', handleTargetHit, { passive: false });
        
        // Display high score
        highScoreElement.textContent = highScore;
        
        console.log("Init complete - Canvas:", canvas.width, canvas.height);
    }
    
    // Resize canvas to fit container
    function resizeCanvas() {
        // Make the game screen temporarily visible if it's not already
        const wasHidden = getComputedStyle(gameScreen).display === 'none';
        if (wasHidden) {
            gameScreen.style.visibility = 'hidden'; // Hide visually but keep layout
            gameScreen.style.display = 'block';     // Make it affect layout
        }
        
        const container = gameScreen;
        console.log("Resizing canvas. Container display:", getComputedStyle(container).display);
        console.log("Container dimensions:", container.clientWidth, container.clientHeight);
        
        // Set canvas dimensions
        canvas.width = container.clientWidth || 800;
        canvas.height = container.clientHeight || 600;
        
        console.log("New canvas dimensions:", canvas.width, canvas.height);
        
        // If we temporarily made it visible, hide it again
        if (wasHidden) {
            gameScreen.style.display = 'none';
            gameScreen.style.visibility = 'visible';
        }
        
        // Redraw any existing targets if the game is active
        if (gameActive && ctx) {
            drawGameElements();
        }
    }
    
    // Start the game
    function startGame() {
        console.log("Game started");
        
        introScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        gameOverScreen.style.display = 'none';
        
        // Make sure the canvas is properly sized now that gameScreen is visible
        resizeCanvas();
        
        // Reset game state
        gameActive = true;
        score = 0;
        lives = 3;
        timeRemaining = 60;
        targets = [];
        powerUps = [];
        difficultyLevel = 1;
        comboCount = 0;
        maxCombo = 0;
        comboMultiplier = 1;
        lastHitTime = 0;
        
        // Reset UI
        updateComboDisplay();
        powerUpDisplay.innerHTML = '';
        comboDisplay.classList.remove('active');
        
        // Reset active power-ups
        activePowerUps.doublePoints.active = false;
        activePowerUps.slowTime.active = false;
        
        if (comboTimer) {
            clearTimeout(comboTimer);
            comboTimer = null;
        }
        
        // Update display
        scoreElement.textContent = score;
        livesElement.textContent = lives;
        timeElement.textContent = timeRemaining;
        
        // Stop any existing game loop
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        // Start game loop
        lastTimestamp = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
        
        // Start timer
        const timerDelay = activePowerUps.slowTime.active ? 1500 : 1000;
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
        }, timerDelay);
        
        // Start spawning targets
        spawnTarget();
        console.log("Initial target spawned", targets.length > 0 ? targets[0] : "No targets");
        targetAppearInterval = setInterval(spawnTarget, 1000);
        
        // Start spawning power-ups occasionally
        powerUpInterval = setInterval(spawnPowerUp, 10000); // Every 10 seconds
    }
    
    // End the game
    function endGame() {
        gameActive = false;
        clearInterval(gameTimer);
        clearInterval(targetAppearInterval);
        clearInterval(powerUpInterval);
        cancelAnimationFrame(animationFrameId);
        
        if (comboTimer) {
            clearTimeout(comboTimer);
            comboTimer = null;
        }
        
        // Update high score
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('highScore', highScore);
        }
        
        // Display game over screen
        finalScoreElement.textContent = score;
        highScoreElement.textContent = highScore;
        maxComboElement.textContent = maxCombo;
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
        
        // Determine target type (more special targets at higher difficulties)
        let targetType = TARGET_TYPES.NORMAL;
        const rand = Math.random();
        
        if (difficultyLevel >= 2) {
            if (rand < 0.1) {
                targetType = TARGET_TYPES.BONUS;
            } else if (rand < 0.3) {
                targetType = TARGET_TYPES.MOVING;
            } else if (rand < 0.5) {
                targetType = TARGET_TYPES.SHRINKING;
            }
        }
        
        // Make sure we're not placing targets outside the canvas
        const canvasWidth = canvas.width || 800;
        const canvasHeight = canvas.height || 600;
        
        // Create the target at a valid position within the canvas
        const target = {
            x: Math.random() * (canvasWidth - radius * 2) + radius,
            y: Math.random() * (canvasHeight - radius * 2) + radius,
            radius: radius,
            color: targetType === TARGET_TYPES.BONUS ? '#FFD700' : targetColors[Math.floor(Math.random() * targetColors.length)],
            createdAt: performance.now(),
            lifetime: targetType === TARGET_TYPES.BONUS ? lifetime * 0.6 : lifetime,
            hit: false,
            points: targetType === TARGET_TYPES.BONUS ? 
                   Math.ceil(difficultyLevel) * (targetMaxRadius - radius + 30) : 
                   Math.ceil(difficultyLevel) * (targetMaxRadius - radius + 10),
            type: targetType,
            // For moving targets
            velocityX: (Math.random() - 0.5) * 3 * difficultyLevel,
            velocityY: (Math.random() - 0.5) * 3 * difficultyLevel,
            // For shrinking targets
            shrinkRate: 0.9
        };
        
        targets.push(target);
        console.log("Target spawned:", target);
        
        // Spawn additional targets based on difficulty
        if (Math.random() < difficultyLevel * 0.1) {
            setTimeout(spawnTarget, 200);
        }
    }
    
    // Spawn a power-up
    function spawnPowerUp() {
        if (!gameActive) return;
        
        // Only spawn if there are not too many power-ups already
        if (powerUps.length >= 2) return;
        
        const radius = 30;
        const allTypes = Object.values(POWER_UP_TYPES);
        const type = allTypes[Math.floor(Math.random() * allTypes.length)];
        
        // Extra lives are rarer
        if (type === POWER_UP_TYPES.EXTRA_LIFE && Math.random() > 0.3) {
            return;
        }
        
        const powerUp = {
            x: Math.random() * (canvas.width - radius * 2) + radius,
            y: Math.random() * (canvas.height - radius * 2) + radius,
            radius: radius,
            color: powerUpColors[type],
            icon: powerUpIcons[type],
            createdAt: performance.now(),
            lifetime: 5000, // Power-ups last 5 seconds
            hit: false,
            type: type
        };
        
        powerUps.push(powerUp);
    }
    
    // Apply a power-up effect
    function applyPowerUp(type) {
        switch (type) {
            case POWER_UP_TYPES.EXTRA_LIFE:
                lives++;
                livesElement.textContent = lives;
                showMessage("Extra Life! ❤️", "#FF5252");
                break;
                
            case POWER_UP_TYPES.TIME_BOOST:
                timeRemaining += 10;
                timeElement.textContent = timeRemaining;
                showMessage("+10 Seconds! ⏱️", "#64FFDA");
                break;
                
            case POWER_UP_TYPES.SLOW_TIME:
                // Clear existing timer and start a new one with slower interval
                clearInterval(gameTimer);
                activePowerUps.slowTime.active = true;
                activePowerUps.slowTime.endTime = performance.now() + 10000;
                
                // Display power-up icon in HUD
                addPowerUpIcon('slowTime', '⏳ Slow Time', 10);
                
                gameTimer = setInterval(() => {
                    timeRemaining--;
                    timeElement.textContent = timeRemaining;
                    
                    if (timeRemaining <= 0) {
                        endGame();
                    }
                    
                    // Check if slow time has ended
                    if (activePowerUps.slowTime.active && performance.now() > activePowerUps.slowTime.endTime) {
                        activePowerUps.slowTime.active = false;
                        clearInterval(gameTimer);
                        gameTimer = setInterval(() => {
                            timeRemaining--;
                            timeElement.textContent = timeRemaining;
                            
                            if (timeRemaining <= 0) {
                                endGame();
                            }
                        }, 1000);
                    }
                }, 1500); // 1.5x slower
                
                showMessage("Slow Time! ⏳", "#536DFE");
                break;
                
            case POWER_UP_TYPES.DOUBLE_POINTS:
                activePowerUps.doublePoints.active = true;
                activePowerUps.doublePoints.endTime = performance.now() + 10000; // 10 seconds
                
                // Display power-up icon in HUD
                addPowerUpIcon('doublePoints', '2️⃣ Double Points', 10);
                
                showMessage("Double Points! 2️⃣", "#FFFF00");
                break;
        }
    }
    
    // Add power-up icon to the HUD
    function addPowerUpIcon(id, text, duration) {
        // Remove existing power-up of the same type if it exists
        const existingPowerUp = document.getElementById(`power-up-${id}`);
        if (existingPowerUp) {
            existingPowerUp.remove();
        }
        
        // Create new power-up icon
        const powerUpIcon = document.createElement('div');
        powerUpIcon.id = `power-up-${id}`;
        powerUpIcon.className = 'power-up-icon';
        powerUpIcon.innerHTML = `${text} <span id="${id}-timer">${duration}s</span>`;
        powerUpDisplay.appendChild(powerUpIcon);
        
        // Start countdown timer
        let timeLeft = duration;
        const timerId = setInterval(() => {
            timeLeft--;
            const timerElement = document.getElementById(`${id}-timer`);
            if (timerElement) {
                timerElement.textContent = `${timeLeft}s`;
            }
            
            if (timeLeft <= 0) {
                clearInterval(timerId);
                if (powerUpIcon.parentNode) {
                    powerUpIcon.remove();
                }
            }
        }, 1000);
    }
    
    // Show a message on screen
    function showMessage(text, color) {
        const message = document.createElement('div');
        message.textContent = text;
        message.style.position = 'absolute';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.color = color;
        message.style.fontSize = '2rem';
        message.style.fontWeight = 'bold';
        message.style.textShadow = '0 0 10px rgba(0, 0, 0, 0.7)';
        message.style.zIndex = '100';
        message.style.opacity = '1';
        message.style.transition = 'opacity 1s ease-out';
        
        gameScreen.appendChild(message);
        
        // Fade out and remove
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 1000);
        }, 1500);
    }
    
    // Update combo display
    function updateComboDisplay() {
        comboCountElement.textContent = comboCount;
        
        if (comboCount >= 2) {
            comboDisplay.classList.add('active');
            comboDisplay.style.animation = 'none';
            // Trigger reflow
            void comboDisplay.offsetWidth;
            comboDisplay.style.animation = 'highlight 0.3s ease';
        } else {
            comboDisplay.classList.remove('active');
        }
        
        // Update max combo
        if (comboCount > maxCombo) {
            maxCombo = comboCount;
        }
    }
    
    // Update combo system
    function updateCombo() {
        const now = performance.now();
        
        // Check if we're within the combo window
        if (now - lastHitTime < comboTimeout) {
            comboCount++;
            
            // Update combo multiplier
            if (comboCount >= 10) {
                comboMultiplier = 3;
                showMessage("3x COMBO!", "#FFFF00");
            } else if (comboCount >= 5) {
                comboMultiplier = 2;
                if (comboMultiplier < 3) {
                    showMessage("2x COMBO!", "#FFD740");
                }
            }
        } else {
            // Reset combo
            comboCount = 1;
            comboMultiplier = 1;
        }
        
        lastHitTime = now;
        
        // Update the combo display
        updateComboDisplay();
        
        // Clear previous combo timer
        if (comboTimer) {
            clearTimeout(comboTimer);
        }
        
        // Set new combo timer
        comboTimer = setTimeout(() => {
            comboCount = 0;
            comboMultiplier = 1;
            updateComboDisplay();
        }, comboTimeout);
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
        
        // Check if any power-up was hit
        let powerUpHit = false;
        for (let i = powerUps.length - 1; i >= 0; i--) {
            const powerUp = powerUps[i];
            const distance = Math.sqrt(
                Math.pow(x - powerUp.x, 2) + Math.pow(y - powerUp.y, 2)
            );
            
            if (distance <= powerUp.radius && !powerUp.hit) {
                // Power-up hit
                powerUp.hit = true;
                powerUpHit = true;
                
                // Apply power-up effect
                applyPowerUp(powerUp.type);
                
                // Remove the power-up
                setTimeout(() => {
                    const index = powerUps.indexOf(powerUp);
                    if (index !== -1) {
                        powerUps.splice(index, 1);
                    }
                }, 100);
                
                break;
            }
        }
        
        // If a power-up was hit, don't check for targets
        if (powerUpHit) return;
        
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
                
                // Update combo
                updateCombo();
                
                // Add score based on target size, lifetime, and combo
                const timeFactor = 1 - ((performance.now() - target.createdAt) / target.lifetime);
                let pointsEarned = Math.ceil(target.points * (timeFactor + 0.5) * comboMultiplier);
                
                // Apply double points power-up if active
                if (activePowerUps.doublePoints.active && performance.now() < activePowerUps.doublePoints.endTime) {
                    pointsEarned *= 2;
                }
                
                score += pointsEarned;
                scoreElement.textContent = score;
                
                // Show score popup
                showPointsPopup(target.x, target.y, pointsEarned, comboMultiplier > 1);
                
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
        if (!targetHit && !powerUpHit) {
            lives--;
            livesElement.textContent = lives;
            
            // Reset combo on miss
            comboCount = 0;
            comboMultiplier = 1;
            updateComboDisplay();
            
            if (comboTimer) {
                clearTimeout(comboTimer);
                comboTimer = null;
            }
            
            if (lives <= 0) {
                endGame();
            }
        }
    }
    
    // Show points popup when target is hit
    function showPointsPopup(x, y, points, isCombo) {
        // Create a floating points text on the canvas
        const popup = {
            x: x,
            y: y,
            text: `+${points}${isCombo ? ' COMBO!' : ''}`,
            opacity: 1,
            fontSize: isCombo ? 28 : 24,
            color: isCombo ? '#FFFF00' : '#FFFFFF'
        };
        
        // Animate the popup
        const animatePopup = () => {
            ctx.save();
            ctx.fillStyle = `rgba(${isCombo ? '255, 255, 0' : '255, 255, 255'}, ${popup.opacity})`;
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
    
    // Draw all game elements (separate from gameLoop for clarity)
    function drawGameElements() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw debug grid for visibility
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
        
        const now = performance.now();
        
        // Draw targets
        targets.forEach(target => {
            if (target.hit) return; // Skip hit targets
            
            const elapsedTime = now - target.createdAt;
            const timeRatio = 1 - (elapsedTime / target.lifetime);
            let currentRadius = target.radius;
            
            // Shrinking targets get smaller over time
            if (target.type === TARGET_TYPES.SHRINKING) {
                currentRadius = target.radius * (0.5 + (timeRatio * 0.5));
            } else {
                // Normal targets pulse slightly
                currentRadius = target.radius * (0.9 + (Math.sin(elapsedTime / 200) * 0.1));
            }
            
            // Draw target based on type
            ctx.beginPath();
            
            if (target.type === TARGET_TYPES.BONUS) {
                // Draw star shape for bonus targets
                const spikes = 5;
                const outerRadius = currentRadius;
                const innerRadius = currentRadius * 0.4;
                
                ctx.beginPath();
                for (let i = 0; i < spikes * 2; i++) {
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const angle = (Math.PI * i) / spikes - Math.PI / 2;
                    const x = target.x + radius * Math.cos(angle);
                    const y = target.y + radius * Math.sin(angle);
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                ctx.fillStyle = target.color;
                ctx.fill();
            } else {
                // Draw regular circle for other targets
                ctx.arc(target.x, target.y, currentRadius, 0, Math.PI * 2);
                ctx.fillStyle = target.color;
                ctx.fill();
            }
            
            // Draw time indicator
            ctx.beginPath();
            ctx.arc(target.x, target.y, currentRadius, 0, Math.PI * 2 * timeRatio);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Add a hint for moving targets
            if (target.type === TARGET_TYPES.MOVING) {
                const arrowSize = currentRadius * 0.3;
                ctx.beginPath();
                ctx.moveTo(target.x, target.y - arrowSize);
                ctx.lineTo(target.x + arrowSize, target.y);
                ctx.lineTo(target.x, target.y + arrowSize);
                ctx.lineTo(target.x - arrowSize, target.y);
                ctx.closePath();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.fill();
            }
            
            // Add a hint for shrinking targets
            if (target.type === TARGET_TYPES.SHRINKING) {
                ctx.beginPath();
                ctx.arc(target.x, target.y, currentRadius * 0.6, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
        
        // Draw power-ups
        powerUps.forEach(powerUp => {
            if (powerUp.hit) return; // Skip hit power-ups
            
            const elapsedTime = now - powerUp.createdAt;
            const pulseScale = 1 + 0.1 * Math.sin(elapsedTime / 200);
            const currentRadius = powerUp.radius * pulseScale;
            
            // Draw circle
            ctx.beginPath();
            ctx.arc(powerUp.x, powerUp.y, currentRadius, 0, Math.PI * 2);
            ctx.fillStyle = powerUp.color;
            ctx.fill();
            
            // Draw outline
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Draw icon
            ctx.font = `${currentRadius}px Arial`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(powerUp.icon, powerUp.x, powerUp.y);
            
            // Draw time indicator
            const timeRatio = 1 - (elapsedTime / powerUp.lifetime);
            ctx.beginPath();
            ctx.arc(powerUp.x, powerUp.y, currentRadius + 5, 0, Math.PI * 2 * timeRatio);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 3;
            ctx.stroke();
        });
    }
    
    // Main game loop
    function gameLoop(timestamp) {
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        
        // Debug information
        if (targets.length === 0) {
            console.log("No targets to draw");
        }
        
        // Check if power-ups have expired
        if (activePowerUps.doublePoints.active && timestamp > activePowerUps.doublePoints.endTime) {
            activePowerUps.doublePoints.active = false;
            const powerUpIcon = document.getElementById('power-up-doublePoints');
            if (powerUpIcon) powerUpIcon.remove();
        }
        
        if (activePowerUps.slowTime.active && timestamp > activePowerUps.slowTime.endTime) {
            activePowerUps.slowTime.active = false;
            const powerUpIcon = document.getElementById('power-up-slowTime');
            if (powerUpIcon) powerUpIcon.remove();
        }
        
        // Update and remove expired targets
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
            
            // Update moving targets
            if (target.type === TARGET_TYPES.MOVING && !target.hit) {
                target.x += target.velocityX;
                target.y += target.velocityY;
                
                // Bounce off walls
                if (target.x - target.radius <= 0 || target.x + target.radius >= canvas.width) {
                    target.velocityX *= -1;
                }
                if (target.y - target.radius <= 0 || target.y + target.radius >= canvas.height) {
                    target.velocityY *= -1;
                }
            }
        }
        
        // Remove expired power-ups
        for (let i = powerUps.length - 1; i >= 0; i--) {
            const powerUp = powerUps[i];
            if (timestamp - powerUp.createdAt >= powerUp.lifetime && !powerUp.hit) {
                powerUps.splice(i, 1);
            }
        }
        
        // Draw all game elements
        drawGameElements();
        
        // Continue the game loop
        if (gameActive) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }
    
    // Initialize the game
    init();
});
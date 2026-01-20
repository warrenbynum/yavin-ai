// ============================================================================
// Yavin AI - Interactive Features v2.0
// Includes: Auth, Progress Tracking, Newsletter, and Interactive Demos
// ============================================================================

// ============================================================================
// Authentication & User Management
// ============================================================================

const YavinAuth = {
    user: null,
    
    async init() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();
            if (data.logged_in) {
                this.user = data.user;
                this.updateUI();
            }
        } catch (e) {
            console.log('Auth check failed, running in anonymous mode');
        }
    },
    
    async register(email, password, name) {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });
        const data = await response.json();
        if (data.success) {
            this.user = data.user;
            this.updateUI();
            closeAuthModal();
            showToast('Welcome to Yavin! Your learning journey begins.');
        }
        return data;
    },
    
    async login(email, password) {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (data.success) {
            this.user = data.user;
            this.updateUI();
            closeAuthModal();
            showToast(`Welcome back! ${data.user.streak_days} day streak!`);
        }
        return data;
    },
    
    async logout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        this.user = null;
        this.updateUI();
        showToast('Logged out successfully');
    },
    
    updateUI() {
        const authBtn = document.getElementById('authButton');
        const userMenu = document.getElementById('userMenu');
        const progressIndicators = document.querySelectorAll('.section-progress');
        
        if (this.user) {
            if (authBtn) authBtn.style.display = 'none';
            if (userMenu) {
                userMenu.style.display = 'flex';
                const userName = userMenu.querySelector('.user-name');
                const userXp = userMenu.querySelector('.user-xp');
                const userStreak = userMenu.querySelector('.user-streak');
                if (userName) userName.textContent = this.user.name || this.user.email.split('@')[0];
                if (userXp) userXp.textContent = `${this.user.total_xp} XP`;
                if (userStreak) userStreak.textContent = `${this.user.streak_days} day streak`;
            }
            progressIndicators.forEach(el => el.style.display = 'block');
        } else {
            if (authBtn) authBtn.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
            progressIndicators.forEach(el => el.style.display = 'none');
        }
    }
};

// ============================================================================
// Progress Tracking
// ============================================================================

const YavinProgress = {
    async markComplete(sectionId) {
        if (!YavinAuth.user) {
            showToast('Sign in to track your progress!');
            openAuthModal();
            return;
        }
        
        const response = await fetch('/api/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section_id: sectionId, completed: true })
        });
        
        const data = await response.json();
        if (data.success) {
            // Update UI
            const btn = document.querySelector(`[data-section="${sectionId}"]`);
            if (btn) {
                btn.classList.add('completed');
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Completed';
            }
            
            if (data.xp_earned > 0) {
                showToast(`+${data.xp_earned} XP earned!`);
                YavinAuth.user.total_xp = data.total_xp;
                YavinAuth.updateUI();
            }
        }
        return data;
    },
    
    async submitQuizToServer(section, score, total) {
        const response = await fetch('/api/quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section, score, total })
        });
        return await response.json();
    }
};

// ============================================================================
// Quiz System
// ============================================================================

async function submitQuiz(sectionId) {
    const container = document.querySelector(`.quiz-container[data-section="${sectionId}"]`);
    if (!container) return;
    
    const questions = container.querySelectorAll('.quiz-question');
    const submitBtn = container.querySelector('.quiz-submit');
    const resultsDiv = container.querySelector('.quiz-results');
    
    let score = 0;
    let total = questions.length;
    let unanswered = 0;
    
    // Check each question
    questions.forEach(question => {
        const selected = question.querySelector('input[type="radio"]:checked');
        const options = question.querySelectorAll('.quiz-option');
        
        if (!selected) {
            unanswered++;
            return;
        }
        
        const isCorrect = selected.dataset.correct === 'true';
        
        // Mark options
        options.forEach(option => {
            const input = option.querySelector('input[type="radio"]');
            option.style.position = 'relative';
            
            if (input.dataset.correct === 'true') {
                option.classList.add('correct');
            } else if (input.checked && !isCorrect) {
                option.classList.add('incorrect');
            }
            
            // Disable further changes
            input.disabled = true;
        });
        
        if (isCorrect) score++;
    });
    
    // Check if all questions answered
    if (unanswered > 0) {
        showToast(`Please answer all ${unanswered} remaining question${unanswered > 1 ? 's' : ''}`);
        return;
    }
    
    // Calculate percentage
    const percentage = Math.round((score / total) * 100);
    
    // Submit to server if logged in
    const serverResult = await YavinProgress.submitQuizToServer(sectionId, score, total);
    
    // Update UI
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitted';
    
    // Show results
    let feedbackMessage = '';
    let feedbackClass = '';
    
    if (percentage === 100) {
        feedbackMessage = 'Perfect score! You have mastered this section.';
        feedbackClass = 'perfect';
    } else if (percentage >= 80) {
        feedbackMessage = 'Excellent work! You have a strong understanding.';
        feedbackClass = 'excellent';
    } else if (percentage >= 60) {
        feedbackMessage = 'Good effort! Consider reviewing some concepts.';
        feedbackClass = 'good';
    } else {
        feedbackMessage = 'Keep learning! Review the section and try again.';
        feedbackClass = 'needs-work';
    }
    
    resultsDiv.innerHTML = `
        <h4>Quiz Results</h4>
        <div class="quiz-score ${feedbackClass}">${score}/${total}</div>
        <p class="quiz-percentage">${percentage}%</p>
        <p class="quiz-feedback">${feedbackMessage}</p>
        ${serverResult.bonus_xp ? `<p class="quiz-bonus">+${serverResult.bonus_xp} bonus XP for perfect score!</p>` : ''}
        ${!serverResult.logged_in ? '<p class="quiz-login-hint">Sign in to save your progress and earn XP!</p>' : ''}
    `;
    resultsDiv.style.display = 'block';
    
    // Scroll to results
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Show toast
    if (serverResult.bonus_xp) {
        showToast(`+${serverResult.bonus_xp} XP bonus for perfect score!`);
    } else {
        showToast(`Quiz complete: ${score}/${total} correct`);
    }
}

// ============================================================================
// Newsletter Subscription
// ============================================================================

async function subscribeNewsletter(email, source = 'website') {
    const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source })
    });
    return await response.json();
}

// ============================================================================
// UI Helpers
// ============================================================================

function showToast(message, duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => toast.classList.add('visible'));
    
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function openAuthModal(mode = 'login') {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.add('active');
        switchAuthMode(mode);
    }
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');
}

function switchAuthMode(mode) {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginTab = document.querySelector('[data-auth-tab="login"]');
    const registerTab = document.querySelector('[data-auth-tab="register"]');
    
    if (mode === 'login') {
        loginForm?.classList.add('active');
        registerForm?.classList.remove('active');
        loginTab?.classList.add('active');
        registerTab?.classList.remove('active');
    } else {
        loginForm?.classList.remove('active');
        registerForm?.classList.add('active');
        loginTab?.classList.remove('active');
        registerTab?.classList.add('active');
    }
}

// ============================================================================
// AI Chat Assistant
// ============================================================================

function toggleAIChat() {
    const chatWindow = document.getElementById('aiChatWindow');
    if (chatWindow.style.display === 'none' || chatWindow.style.display === '') {
        chatWindow.style.display = 'flex';
        document.getElementById('aiChatInput')?.focus();
    } else {
        chatWindow.style.display = 'none';
    }
}

function addChatMessage(text, type) {
    const messagesDiv = document.getElementById('aiChatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'user' ? 'user-message' : 'ai-message';
    
    const p = document.createElement('p');
    p.textContent = text;
    messageDiv.appendChild(p);
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    return messageDiv;
}

function addTypingIndicator() {
    const messagesDiv = document.getElementById('aiChatMessages');
    const indicator = document.createElement('div');
    indicator.className = 'ai-message typing-indicator';
    indicator.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    messagesDiv.appendChild(indicator);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return indicator;
}

// ============================================================================
// Gradient Descent Visualizer
// ============================================================================

const GradientDescentDemo = {
    canvas: null,
    ctx: null,
    isRunning: false,
    currentX: 0,
    learningRate: 0.1,
    history: [],
    
    // Simple quadratic function: f(x) = x^2
    f(x) { return x * x; },
    df(x) { return 2 * x; },
    
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.reset();
        this.draw();
    },
    
    reset() {
        this.currentX = (Math.random() - 0.5) * 6; // Random start between -3 and 3
        this.history = [{ x: this.currentX, y: this.f(this.currentX) }];
        this.isRunning = false;
        this.updateStatus('Click "Start" to begin gradient descent');
    },
    
    draw() {
        const { canvas, ctx, f } = this;
        const width = canvas.width;
        const height = canvas.height;
        const padding = 40;
        
        // Clear
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#000';
        ctx.fillRect(0, 0, width, height);
        
        // Draw axes
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary').trim() || '#666';
        ctx.lineWidth = 1;
        
        // X axis
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Y axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.stroke();
        
        // Draw function curve
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const xMin = -4, xMax = 4;
        const yMax = 10;
        
        for (let px = padding; px <= width - padding; px++) {
            const x = xMin + (px - padding) / (width - 2 * padding) * (xMax - xMin);
            const y = f(x);
            const py = height - padding - (y / yMax) * (height - 2 * padding);
            
            if (px === padding) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
        
        // Draw history path
        if (this.history.length > 1) {
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            this.history.forEach((point, i) => {
                const px = padding + (point.x - xMin) / (xMax - xMin) * (width - 2 * padding);
                const py = height - padding - (point.y / yMax) * (height - 2 * padding);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            });
            ctx.stroke();
        }
        
        // Draw current point
        const currentPx = padding + (this.currentX - xMin) / (xMax - xMin) * (width - 2 * padding);
        const currentPy = height - padding - (f(this.currentX) / yMax) * (height - 2 * padding);
        
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(currentPx, currentPy, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw gradient arrow
        const grad = this.df(this.currentX);
        const arrowLength = Math.min(50, Math.abs(grad) * 20);
        const arrowDir = grad > 0 ? -1 : 1;
        
        ctx.strokeStyle = '#FF5722';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(currentPx, currentPy);
        ctx.lineTo(currentPx + arrowDir * arrowLength, currentPy);
        ctx.stroke();
        
        // Arrow head
        ctx.fillStyle = '#FF5722';
        ctx.beginPath();
        ctx.moveTo(currentPx + arrowDir * arrowLength, currentPy);
        ctx.lineTo(currentPx + arrowDir * (arrowLength - 8), currentPy - 5);
        ctx.lineTo(currentPx + arrowDir * (arrowLength - 8), currentPy + 5);
        ctx.closePath();
        ctx.fill();
        
        // Labels
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#fff';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('x', width - 20, height - padding + 15);
        ctx.fillText('f(x) = x²', width / 2, 25);
        
        // Display current values
        const infoY = 50;
        ctx.textAlign = 'left';
        ctx.fillText(`x = ${this.currentX.toFixed(4)}`, 60, infoY);
        ctx.fillText(`f(x) = ${f(this.currentX).toFixed(4)}`, 60, infoY + 20);
        ctx.fillText(`gradient = ${grad.toFixed(4)}`, 60, infoY + 40);
        ctx.fillText(`steps = ${this.history.length - 1}`, 60, infoY + 60);
    },
    
    step() {
        const grad = this.df(this.currentX);
        this.currentX = this.currentX - this.learningRate * grad;
        this.history.push({ x: this.currentX, y: this.f(this.currentX) });
        this.draw();
        
        // Check convergence
        if (Math.abs(grad) < 0.001) {
            this.isRunning = false;
            this.updateStatus('Converged! Minimum found at x ≈ 0');
            return false;
        }
        return true;
    },
    
    async run() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.updateStatus('Running gradient descent...');
        
        while (this.isRunning && this.history.length < 100) {
            if (!this.step()) break;
            await new Promise(r => setTimeout(r, 100));
        }
        
        if (this.history.length >= 100) {
            this.updateStatus('Stopped after 100 steps');
        }
        this.isRunning = false;
    },
    
    stop() {
        this.isRunning = false;
        this.updateStatus('Paused');
    },
    
    updateStatus(msg) {
        const status = document.getElementById('gdStatus');
        if (status) status.textContent = msg;
    },
    
    setLearningRate(rate) {
        this.learningRate = rate;
        const display = document.getElementById('gdLrValue');
        if (display) display.textContent = rate.toFixed(3);
    }
};

// ============================================================================
// Decision Boundary Visualizer
// ============================================================================

const DecisionBoundaryDemo = {
    canvas: null,
    ctx: null,
    points: [],
    weights: [0, 0],
    bias: 0,
    learningRate: 0.1,
    isTraining: false,
    epoch: 0,
    
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.generateData();
        this.draw();
        
        // Click to add points
        this.canvas.addEventListener('click', (e) => this.addPoint(e));
    },
    
    generateData() {
        this.points = [];
        // Generate two clusters
        for (let i = 0; i < 15; i++) {
            // Class 0 (bottom-left)
            this.points.push({
                x: Math.random() * 0.4 + 0.1,
                y: Math.random() * 0.4 + 0.1,
                label: 0
            });
            // Class 1 (top-right)
            this.points.push({
                x: Math.random() * 0.4 + 0.5,
                y: Math.random() * 0.4 + 0.5,
                label: 1
            });
        }
        this.weights = [Math.random() - 0.5, Math.random() - 0.5];
        this.bias = Math.random() - 0.5;
        this.epoch = 0;
    },
    
    addPoint(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.canvas.width;
        const y = 1 - (e.clientY - rect.top) / this.canvas.height;
        
        // Alternate labels based on which side of current boundary
        const prediction = this.predict(x, y);
        this.points.push({ x, y, label: prediction > 0.5 ? 0 : 1 });
        this.draw();
    },
    
    sigmoid(z) {
        return 1 / (1 + Math.exp(-z));
    },
    
    predict(x, y) {
        const z = this.weights[0] * x + this.weights[1] * y + this.bias;
        return this.sigmoid(z);
    },
    
    trainStep() {
        let totalLoss = 0;
        let dw0 = 0, dw1 = 0, db = 0;
        
        for (const point of this.points) {
            const pred = this.predict(point.x, point.y);
            const error = pred - point.label;
            
            dw0 += error * point.x;
            dw1 += error * point.y;
            db += error;
            
            totalLoss += -point.label * Math.log(pred + 1e-8) - (1 - point.label) * Math.log(1 - pred + 1e-8);
        }
        
        const n = this.points.length;
        this.weights[0] -= this.learningRate * dw0 / n;
        this.weights[1] -= this.learningRate * dw1 / n;
        this.bias -= this.learningRate * db / n;
        
        this.epoch++;
        return totalLoss / n;
    },
    
    draw() {
        const { canvas, ctx, points, weights, bias } = this;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#000';
        ctx.fillRect(0, 0, width, height);
        
        // Draw decision boundary heatmap
        const resolution = 20;
        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                const x = (i + 0.5) / resolution;
                const y = (j + 0.5) / resolution;
                const pred = this.predict(x, y);
                
                const r = Math.floor(pred * 100);
                const b = Math.floor((1 - pred) * 100);
                ctx.fillStyle = `rgba(${r}, ${50}, ${b}, 0.3)`;
                
                ctx.fillRect(
                    i * width / resolution,
                    height - (j + 1) * height / resolution,
                    width / resolution,
                    height / resolution
                );
            }
        }
        
        // Draw decision boundary line
        if (Math.abs(weights[1]) > 0.001) {
            ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            // Line where sigmoid = 0.5, i.e., w0*x + w1*y + b = 0
            const x1 = 0;
            const y1 = (-weights[0] * x1 - bias) / weights[1];
            const x2 = 1;
            const y2 = (-weights[0] * x2 - bias) / weights[1];
            
            ctx.moveTo(x1 * width, height - y1 * height);
            ctx.lineTo(x2 * width, height - y2 * height);
            ctx.stroke();
        }
        
        // Draw points
        for (const point of points) {
            ctx.beginPath();
            ctx.arc(point.x * width, height - point.y * height, 8, 0, Math.PI * 2);
            
            if (point.label === 0) {
                ctx.fillStyle = '#2196F3';
            } else {
                ctx.fillStyle = '#FF5722';
            }
            ctx.fill();
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Display info
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#fff';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(`Epoch: ${this.epoch}`, 10, 20);
        ctx.fillText(`w₁: ${weights[0].toFixed(3)}, w₂: ${weights[1].toFixed(3)}, b: ${bias.toFixed(3)}`, 10, 40);
    },
    
    async train(epochs = 100) {
        if (this.isTraining) return;
        this.isTraining = true;
        
        for (let i = 0; i < epochs && this.isTraining; i++) {
            this.trainStep();
            this.draw();
            await new Promise(r => setTimeout(r, 50));
        }
        
        this.isTraining = false;
    },
    
    stop() {
        this.isTraining = false;
    },
    
    reset() {
        this.generateData();
        this.draw();
    }
};

// ============================================================================
// Attention Mechanism Visualizer
// ============================================================================

const AttentionDemo = {
    canvas: null,
    ctx: null,
    tokens: ['The', 'cat', 'sat', 'on', 'the', 'mat'],
    attentionWeights: [],
    selectedToken: 0,
    
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.generateAttention();
        this.draw();
        
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
    },
    
    generateAttention() {
        const n = this.tokens.length;
        this.attentionWeights = [];
        
        for (let i = 0; i < n; i++) {
            const row = [];
            let sum = 0;
            for (let j = 0; j < n; j++) {
                // Create somewhat realistic attention patterns
                let weight;
                if (i === j) {
                    weight = 0.3 + Math.random() * 0.2; // Self-attention
                } else if (Math.abs(i - j) === 1) {
                    weight = 0.1 + Math.random() * 0.15; // Adjacent tokens
                } else {
                    weight = Math.random() * 0.1;
                }
                row.push(weight);
                sum += weight;
            }
            // Normalize (softmax-like)
            this.attentionWeights.push(row.map(w => w / sum));
        }
    },
    
    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const tokenWidth = this.canvas.width / this.tokens.length;
        
        this.selectedToken = Math.floor(x / tokenWidth);
        this.selectedToken = Math.max(0, Math.min(this.tokens.length - 1, this.selectedToken));
        this.draw();
    },
    
    draw() {
        const { canvas, ctx, tokens, attentionWeights, selectedToken } = this;
        const width = canvas.width;
        const height = canvas.height;
        const tokenWidth = width / tokens.length;
        const topY = 60;
        const bottomY = height - 60;
        
        // Clear
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#000';
        ctx.fillRect(0, 0, width, height);
        
        // Title
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#fff';
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Self-Attention Visualization', width / 2, 25);
        ctx.font = '11px system-ui';
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary').trim() || '#888';
        ctx.fillText('Click a token to see what it attends to', width / 2, 42);
        
        // Draw attention connections
        const weights = attentionWeights[selectedToken];
        for (let j = 0; j < tokens.length; j++) {
            const weight = weights[j];
            const startX = selectedToken * tokenWidth + tokenWidth / 2;
            const endX = j * tokenWidth + tokenWidth / 2;
            
            // Draw curved line
            ctx.strokeStyle = `rgba(100, 200, 255, ${weight})`;
            ctx.lineWidth = weight * 10;
            
            ctx.beginPath();
            ctx.moveTo(startX, bottomY - 20);
            
            // Bezier curve
            const midY = (topY + bottomY) / 2;
            const curveHeight = Math.abs(selectedToken - j) * 15;
            ctx.quadraticCurveTo(
                (startX + endX) / 2,
                midY - curveHeight,
                endX,
                topY + 20
            );
            ctx.stroke();
        }
        
        // Draw tokens (query - bottom)
        for (let i = 0; i < tokens.length; i++) {
            const x = i * tokenWidth + tokenWidth / 2;
            
            // Token box
            const isSelected = i === selectedToken;
            ctx.fillStyle = isSelected ? 'rgba(100, 200, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
            ctx.strokeStyle = isSelected ? 'rgba(100, 200, 255, 0.8)' : 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = isSelected ? 2 : 1;
            
            const boxWidth = tokenWidth - 10;
            const boxHeight = 30;
            ctx.beginPath();
            ctx.roundRect(x - boxWidth / 2, bottomY - boxHeight / 2, boxWidth, boxHeight, 4);
            ctx.fill();
            ctx.stroke();
            
            // Token text
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#fff';
            ctx.font = '13px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tokens[i], x, bottomY);
        }
        
        // Draw tokens (key/value - top)
        for (let i = 0; i < tokens.length; i++) {
            const x = i * tokenWidth + tokenWidth / 2;
            const weight = weights[i];
            
            // Token box with attention-weighted color
            ctx.fillStyle = `rgba(100, 200, 255, ${0.1 + weight * 0.5})`;
            ctx.strokeStyle = `rgba(100, 200, 255, ${0.3 + weight * 0.7})`;
            ctx.lineWidth = 1 + weight * 2;
            
            const boxWidth = tokenWidth - 10;
            const boxHeight = 30;
            ctx.beginPath();
            ctx.roundRect(x - boxWidth / 2, topY - boxHeight / 2, boxWidth, boxHeight, 4);
            ctx.fill();
            ctx.stroke();
            
            // Token text
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#fff';
            ctx.font = '13px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tokens[i], x, topY);
            
            // Attention weight
            ctx.font = '10px system-ui';
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary').trim() || '#888';
            ctx.fillText((weight * 100).toFixed(0) + '%', x, topY + 25);
        }
        
        // Labels
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary').trim() || '#888';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText('Keys/Values', 10, topY);
        ctx.fillText('Query', 10, bottomY);
    },
    
    setTokens(tokenString) {
        this.tokens = tokenString.split(' ').filter(t => t.length > 0).slice(0, 8);
        this.selectedToken = 0;
        this.generateAttention();
        this.draw();
    },
    
    regenerate() {
        this.generateAttention();
        this.draw();
    }
};

// ============================================================================
// Neural Network Builder (Enhanced)
// ============================================================================

let networkLayers = [];
let networkCanvas = null;
let networkCtx = null;
let lossChartCanvas = null;
let lossChartCtx = null;
let trainingData = [];
let isTraining = false;
let trainingHistory = [];

const datasets = {
    xor: { name: 'XOR Problem', inputSize: 2, outputSize: 1 },
    iris: { name: 'Iris Classification', inputSize: 4, outputSize: 3 },
    spiral: { name: 'Spiral Dataset', inputSize: 2, outputSize: 2 }
};

function initNNBuilder() {
    networkCanvas = document.getElementById('nnCanvas');
    if (!networkCanvas) return;
    
    networkCtx = networkCanvas.getContext('2d');
    lossChartCanvas = document.getElementById('lossChart');
    if (lossChartCanvas) lossChartCtx = lossChartCanvas.getContext('2d');
    
    addLayer('input');
    addLayer('hidden');
    addLayer('output');
    drawNetwork();
}

function addLayer(type) {
    const activation = document.getElementById('activationFunction')?.value || 'relu';
    const dataset = document.getElementById('datasetSelect')?.value || 'xor';
    
    let neurons = 4;
    if (type === 'input') neurons = datasets[dataset]?.inputSize || 2;
    else if (type === 'output') neurons = datasets[dataset]?.outputSize || 1;
    else neurons = Math.floor(Math.random() * 6) + 4;
    
    networkLayers.push({
        type,
        neurons,
        activation: type === 'output' ? 'sigmoid' : activation,
        x: 100 + networkLayers.length * 150,
        y: 200
    });
    
    drawNetwork();
    updateStatus(`Added ${type} layer with ${neurons} neurons`);
}

function drawNetwork() {
    if (!networkCtx) return;
    
    const canvas = networkCanvas;
    networkCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw connections
    for (let i = 0; i < networkLayers.length - 1; i++) {
        const layer1 = networkLayers[i];
        const layer2 = networkLayers[i + 1];
        
        networkCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-tertiary').trim() || '#666';
        networkCtx.lineWidth = 1;
        networkCtx.globalAlpha = 0.3;
        
        for (let n1 = 0; n1 < layer1.neurons; n1++) {
            for (let n2 = 0; n2 < layer2.neurons; n2++) {
                const y1 = getNeuronY(layer1, n1);
                const y2 = getNeuronY(layer2, n2);
                
                networkCtx.beginPath();
                networkCtx.moveTo(layer1.x + 20, y1);
                networkCtx.lineTo(layer2.x - 20, y2);
                networkCtx.stroke();
            }
        }
        networkCtx.globalAlpha = 1.0;
    }
    
    // Draw neurons
    networkLayers.forEach((layer) => {
        for (let i = 0; i < layer.neurons; i++) {
            const y = getNeuronY(layer, i);
            
            networkCtx.beginPath();
            networkCtx.arc(layer.x, y, 15, 0, Math.PI * 2);
            networkCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#000';
            networkCtx.fill();
            networkCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#fff';
            networkCtx.lineWidth = 2;
            networkCtx.stroke();
        }
        
        networkCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#fff';
        networkCtx.font = '12px system-ui';
        networkCtx.textAlign = 'center';
        networkCtx.fillText(layer.type.toUpperCase(), layer.x, 30);
        networkCtx.fillText(`(${layer.neurons})`, layer.x, 45);
    });
}

function getNeuronY(layer, neuronIndex) {
    const spacing = 40;
    const totalHeight = layer.neurons * spacing;
    const startY = (400 - totalHeight) / 2 + spacing / 2;
    return startY + neuronIndex * spacing;
}

function resetNetwork() {
    networkLayers = [];
    trainingHistory = [];
    isTraining = false;
    
    if (networkCtx) networkCtx.clearRect(0, 0, networkCanvas.width, networkCanvas.height);
    if (lossChartCtx) lossChartCtx.clearRect(0, 0, lossChartCanvas.width, lossChartCanvas.height);
    
    const currentEpoch = document.getElementById('currentEpoch');
    const currentLoss = document.getElementById('currentLoss');
    const currentAccuracy = document.getElementById('currentAccuracy');
    const backpropViz = document.getElementById('backpropViz');
    
    if (currentEpoch) currentEpoch.textContent = '0';
    if (currentLoss) currentLoss.textContent = '-';
    if (currentAccuracy) currentAccuracy.textContent = '-';
    if (backpropViz) backpropViz.innerHTML = '<p>Start training to see gradients flow backward!</p>';
    
    updateStatus('Network reset. Add layers to begin!');
}

async function trainNetwork() {
    if (networkLayers.length < 2) {
        updateStatus('Add at least input and output layers!');
        return;
    }
    
    if (isTraining) return;
    isTraining = true;
    
    const trainBtn = document.getElementById('trainBtn');
    if (trainBtn) trainBtn.disabled = true;
    
    const epochs = parseInt(document.getElementById('epochs')?.value || '100');
    trainingHistory = [];
    
    updateStatus('Training...');
    
    for (let epoch = 0; epoch < epochs && isTraining; epoch++) {
        const loss = Math.max(0.01, 2 * Math.exp(-epoch / (epochs / 3)) + Math.random() * 0.1);
        const accuracy = Math.min(0.99, 1 - loss + Math.random() * 0.05);
        
        trainingHistory.push({ epoch: epoch + 1, loss });
        
        const currentEpoch = document.getElementById('currentEpoch');
        const currentLoss = document.getElementById('currentLoss');
        const currentAccuracy = document.getElementById('currentAccuracy');
        
        if (currentEpoch) currentEpoch.textContent = epoch + 1;
        if (currentLoss) currentLoss.textContent = loss.toFixed(4);
        if (currentAccuracy) currentAccuracy.textContent = (accuracy * 100).toFixed(1) + '%';
        
        if (epoch % 5 === 0) {
            drawLossChart();
            visualizeBackprop(epoch);
        }
        
        await new Promise(r => setTimeout(r, 20));
    }
    
    isTraining = false;
    if (trainBtn) trainBtn.disabled = false;
    updateStatus('Training complete!');
}

function drawLossChart() {
    if (!lossChartCtx || trainingHistory.length === 0) return;
    
    const canvas = lossChartCanvas;
    const ctx = lossChartCtx;
    const width = canvas.width;
    const height = canvas.height;
    const padding = 30;
    
    ctx.clearRect(0, 0, width, height);
    
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#fff';
    
    // Axes
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    if (trainingHistory.length > 1) {
        const maxEpoch = trainingHistory[trainingHistory.length - 1].epoch;
        const maxLoss = Math.max(...trainingHistory.map(d => d.loss));
        
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        trainingHistory.forEach((point, i) => {
            const x = padding + (point.epoch / maxEpoch) * (width - 2 * padding);
            const y = height - padding - (point.loss / maxLoss) * (height - 2 * padding);
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }
}

function visualizeBackprop(epoch) {
    const backpropDiv = document.getElementById('backpropViz');
    if (!backpropDiv) return;
    
    const gradients = networkLayers.slice().reverse().map(layer => ({
        layer: layer.type,
        gradient: ((Math.random() * 0.5 + 0.5) * Math.exp(-epoch / 50)).toFixed(4)
    }));
    
    backpropDiv.innerHTML = `
        <div class="gradient-flow">
            ${gradients.map(g => `<div class="gradient-layer"><strong>${g.layer}:</strong> ∇L = ${g.gradient}</div>`).join('')}
        </div>
    `;
}

function updateStatus(message) {
    const status = document.getElementById('trainingStatus');
    if (status) status.innerHTML = `<p>${message}</p>`;
}

// ============================================================================
// Feedback Modal
// ============================================================================

function openFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) modal.classList.add('active');
}

function closeFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) modal.classList.remove('active');
}

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize auth
    await YavinAuth.init();
    
    // Initialize demos if present
    if (document.getElementById('gdCanvas')) {
        GradientDescentDemo.init('gdCanvas');
    }
    
    if (document.getElementById('dbCanvas')) {
        DecisionBoundaryDemo.init('dbCanvas');
    }
    
    if (document.getElementById('attentionCanvas')) {
        AttentionDemo.init('attentionCanvas');
    }
    
    if (document.getElementById('nnCanvas')) {
        initNNBuilder();
    }
    
    // Auth form handlers
    const loginForm = document.getElementById('loginFormElement');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const result = await YavinAuth.login(email, password);
            if (result.error) {
                showToast(result.error);
            }
        });
    }
    
    const registerForm = document.getElementById('registerFormElement');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const name = document.getElementById('registerName').value;
            const result = await YavinAuth.register(email, password, name);
            if (result.error) {
                showToast(result.error);
            }
        });
    }
    
    // Newsletter form
    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('newsletterEmail').value;
            const result = await subscribeNewsletter(email);
            showToast(result.message || result.error);
            if (result.success) {
                newsletterForm.reset();
            }
        });
    }
    
    // Feedback form
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(feedbackForm);
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.get('name'),
                    email: formData.get('email'),
                    rating: parseInt(formData.get('rating')),
                    message: formData.get('message'),
                    page_url: window.location.href
                })
            });
            const result = await response.json();
            if (result.success) {
                document.getElementById('feedbackForm').style.display = 'none';
                document.getElementById('feedbackSuccess').style.display = 'block';
            }
        });
    }
    
    // AI Chat form
    const chatForm = document.getElementById('aiChatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('aiChatInput');
            const message = input.value.trim();
            if (!message) return;
            
            addChatMessage(message, 'user');
            input.value = '';
            
            const typingIndicator = addTypingIndicator();
            const sendBtn = chatForm.querySelector('.ai-chat-send');
            if (sendBtn) sendBtn.disabled = true;
            
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });
                const data = await response.json();
                typingIndicator.remove();
                addChatMessage(data.response || 'Sorry, I couldn\'t process that.', 'ai');
            } catch (e) {
                typingIndicator.remove();
                addChatMessage('Connection error. Please try again.', 'ai');
            } finally {
                if (sendBtn) sendBtn.disabled = false;
            }
        });
    }
    
    // Mark complete buttons
    document.querySelectorAll('.mark-complete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionId = btn.dataset.section;
            YavinProgress.markComplete(sectionId);
        });
    });
});

// ============================================================================
// Code Playground with Pyodide
// ============================================================================

const CodePlayground = {
    pyodide: null,
    isLoading: false,
    isReady: false,
    
    async init() {
        if (this.isLoading || this.isReady) return;
        if (!document.getElementById('codeEditor')) return;
        
        this.isLoading = true;
        this.updateStatus('Loading Python...', 'loading');
        
        try {
            // Load Pyodide from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
            document.head.appendChild(script);
            
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });
            
            // Initialize Pyodide
            this.pyodide = await loadPyodide({
                indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
            });
            
            // Load numpy (commonly used)
            await this.pyodide.loadPackage(['numpy']);
            
            this.isReady = true;
            this.isLoading = false;
            this.updateStatus('Ready', 'ready');
            
            // Enable run button
            const runBtn = document.getElementById('runCode');
            if (runBtn) runBtn.disabled = false;
            
            // Set initial output
            this.setOutput('Python is ready! Click "Run" to execute your code.\n\nNumPy is available as: import numpy as np');
            
        } catch (error) {
            this.isLoading = false;
            this.updateStatus('Failed to load', 'error');
            this.setOutput('Error loading Python: ' + error.message, true);
        }
    },
    
    async run() {
        if (!this.isReady) {
            this.setOutput('Python is still loading. Please wait...', true);
            return;
        }
        
        const editor = document.getElementById('codeEditor');
        const code = editor.value;
        
        this.updateStatus('Running...', 'loading');
        
        try {
            // Redirect stdout
            this.pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
            `);
            
            // Run user code
            await this.pyodide.runPythonAsync(code);
            
            // Get output
            const stdout = this.pyodide.runPython('sys.stdout.getvalue()');
            const stderr = this.pyodide.runPython('sys.stderr.getvalue()');
            
            let output = stdout;
            if (stderr) {
                output += '\n\nStderr:\n' + stderr;
            }
            
            if (!output.trim()) {
                output = '(No output. Use print() to see results.)';
            }
            
            this.setOutput(output);
            this.updateStatus('Ready', 'ready');
            
        } catch (error) {
            this.setOutput('Error:\n' + error.message, true);
            this.updateStatus('Error', 'error');
        }
    },
    
    setOutput(text, isError = false) {
        const output = document.getElementById('codeOutput');
        if (output) {
            output.textContent = text;
            output.classList.toggle('error', isError);
        }
    },
    
    clearOutput() {
        this.setOutput('');
    },
    
    updateStatus(text, state) {
        const status = document.getElementById('pyodideStatus');
        if (status) {
            status.textContent = text;
            status.className = 'playground-status';
            if (state === 'ready') status.classList.add('ready');
            if (state === 'error') status.classList.add('error');
        }
    },
    
    loadExample(exampleId) {
        const exampleScript = document.getElementById('example-' + exampleId);
        const editor = document.getElementById('codeEditor');
        
        if (exampleScript && editor) {
            editor.value = exampleScript.textContent.trim();
            this.clearOutput();
            
            // Update active tab
            document.querySelectorAll('.playground-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.example === exampleId);
            });
        }
    }
};

// Initialize playground when on playground page
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('codeEditor')) {
        CodePlayground.init();
        
        // Run button
        const runBtn = document.getElementById('runCode');
        if (runBtn) {
            runBtn.addEventListener('click', () => CodePlayground.run());
        }
        
        // Clear button
        const clearBtn = document.getElementById('clearOutput');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => CodePlayground.clearOutput());
        }
        
        // Tab buttons
        document.querySelectorAll('.playground-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                CodePlayground.loadExample(tab.dataset.example);
            });
        });
        
        // Example cards
        document.querySelectorAll('.playground-example-card').forEach(card => {
            card.addEventListener('click', () => {
                CodePlayground.loadExample(card.dataset.example);
                // Scroll to editor
                document.querySelector('.playground-container')?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            });
        });
        
        // Keyboard shortcut: Ctrl+Enter to run
        document.getElementById('codeEditor')?.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                CodePlayground.run();
            }
        });
    }
});

// Export for global access
window.GradientDescentDemo = GradientDescentDemo;
window.DecisionBoundaryDemo = DecisionBoundaryDemo;
window.AttentionDemo = AttentionDemo;
window.YavinAuth = YavinAuth;
window.YavinProgress = YavinProgress;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthMode = switchAuthMode;
window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.toggleAIChat = toggleAIChat;
window.addLayer = addLayer;
window.resetNetwork = resetNetwork;
window.trainNetwork = trainNetwork;
window.submitQuiz = submitQuiz;
window.CodePlayground = CodePlayground;

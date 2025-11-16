// ============================================================================
// AI Chat Assistant Functionality
// ============================================================================

function toggleAIChat() {
    const chatWindow = document.getElementById('aiChatWindow');
    if (chatWindow.style.display === 'none' || chatWindow.style.display === '') {
        chatWindow.style.display = 'flex';
        document.getElementById('aiChatInput').focus();
    } else {
        chatWindow.style.display = 'none';
    }
}

// Handle chat form submission
document.addEventListener('DOMContentLoaded', () => {
    const chatForm = document.getElementById('aiChatForm');
    if (chatForm) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const input = document.getElementById('aiChatInput');
            const message = input.value.trim();
            
            if (!message) return;
            
            // Add user message to chat
            addMessage(message, 'user');
            input.value = '';
            
            // Show typing indicator
            const typingIndicator = addTypingIndicator();
            
            // Disable send button while waiting
            const sendBtn = e.target.querySelector('.ai-chat-send');
            sendBtn.disabled = true;
            
            try {
                // Call backend API
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ message: message })
                });
                
                const data = await response.json();
                
                // Remove typing indicator
                typingIndicator.remove();
                
                // Add AI response
                if (data.response) {
                    addMessage(data.response, 'ai');
                } else if (data.error) {
                    addMessage(`Sorry, I encountered an error: ${data.error}`, 'ai');
                } else {
                    addMessage('Sorry, I couldn\'t process that. Please try again.', 'ai');
                }
            } catch (error) {
                typingIndicator.remove();
                addMessage('Sorry, I\'m having trouble connecting. Please try again later.', 'ai');
                console.error('Chat error:', error);
            } finally {
                sendBtn.disabled = false;
            }
        });
    }
});

function addMessage(text, type) {
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
// Neural Network Builder Functionality
// ============================================================================

// Network state
let networkLayers = [];
let networkCanvas = null;
let networkCtx = null;
let lossChartCanvas = null;
let lossChartCtx = null;
let trainingData = [];
let isTraining = false;
let trainingHistory = [];

// Sample datasets
const datasets = {
    xor: {
        name: 'XOR Problem',
        inputs: [[0, 0], [0, 1], [1, 0], [1, 1]],
        outputs: [[0], [1], [1], [0]],
        inputSize: 2,
        outputSize: 1
    },
    iris: {
        name: 'Iris Classification (Simplified)',
        inputs: [
            [5.1, 3.5, 1.4, 0.2], [4.9, 3.0, 1.4, 0.2], [6.2, 2.9, 4.3, 1.3],
            [5.9, 3.0, 5.1, 1.8], [6.3, 3.3, 6.0, 2.5], [5.8, 2.7, 5.1, 1.9]
        ],
        outputs: [
            [1, 0, 0], [1, 0, 0], [0, 1, 0],
            [0, 0, 1], [0, 0, 1], [0, 0, 1]
        ],
        inputSize: 4,
        outputSize: 3
    },
    spiral: {
        name: 'Spiral Dataset',
        inputs: [],
        outputs: [],
        inputSize: 2,
        outputSize: 2
    }
};

// Generate spiral dataset
function generateSpiralData() {
    const points = 50;
    for (let i = 0; i < points; i++) {
        const r = i / points * 5;
        const t = 1.75 * i / points * 2 * Math.PI;
        datasets.spiral.inputs.push([r * Math.cos(t), r * Math.sin(t)]);
        datasets.spiral.outputs.push([1, 0]);
        
        const t2 = t + Math.PI;
        datasets.spiral.inputs.push([r * Math.cos(t2), r * Math.sin(t2)]);
        datasets.spiral.outputs.push([0, 1]);
    }
}

// Initialize neural network builder
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('nnCanvas')) {
        initNNBuilder();
    }
});

function initNNBuilder() {
    networkCanvas = document.getElementById('nnCanvas');
    networkCtx = networkCanvas.getContext('2d');
    lossChartCanvas = document.getElementById('lossChart');
    lossChartCtx = lossChartCanvas.getContext('2d');
    
    generateSpiralData();
    
    // Update slider displays
    const lrSlider = document.getElementById('learningRate');
    const epochSlider = document.getElementById('epochs');
    
    if (lrSlider) {
        lrSlider.addEventListener('input', (e) => {
            document.getElementById('lrValue').textContent = parseFloat(e.target.value).toFixed(3);
        });
    }
    
    if (epochSlider) {
        epochSlider.addEventListener('input', (e) => {
            document.getElementById('epochValue').textContent = e.target.value;
        });
    }
    
    // Initialize with a simple network
    addLayer('input');
    addLayer('hidden');
    addLayer('output');
    
    drawNetwork();
}

function addLayer(type) {
    const activation = document.getElementById('activationFunction').value;
    const dataset = document.getElementById('datasetSelect').value;
    
    let neurons = 4; // default
    
    if (type === 'input') {
        neurons = datasets[dataset].inputSize;
    } else if (type === 'output') {
        neurons = datasets[dataset].outputSize;
    } else {
        neurons = Math.floor(Math.random() * 6) + 4; // 4-9 neurons
    }
    
    const layer = {
        type: type,
        neurons: neurons,
        activation: type === 'output' ? 'sigmoid' : activation,
        x: 100 + networkLayers.length * 150,
        y: 200
    };
    
    networkLayers.push(layer);
    drawNetwork();
    
    updateStatus(`Added ${type} layer with ${neurons} neurons`);
}

function drawNetwork() {
    if (!networkCtx) return;
    
    const canvas = networkCanvas;
    networkCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw connections first (so they appear behind neurons)
    for (let i = 0; i < networkLayers.length - 1; i++) {
        const layer1 = networkLayers[i];
        const layer2 = networkLayers[i + 1];
        
        networkCtx.strokeStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-tertiary').trim() || '#666';
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
    networkLayers.forEach((layer, layerIdx) => {
        for (let i = 0; i < layer.neurons; i++) {
            const y = getNeuronY(layer, i);
            
            // Draw neuron circle
            networkCtx.beginPath();
            networkCtx.arc(layer.x, y, 15, 0, Math.PI * 2);
            networkCtx.fillStyle = getComputedStyle(document.documentElement)
                .getPropertyValue('--bg-primary').trim() || '#fff';
            networkCtx.fill();
            networkCtx.strokeStyle = getComputedStyle(document.documentElement)
                .getPropertyValue('--text-primary').trim() || '#000';
            networkCtx.lineWidth = 2;
            networkCtx.stroke();
        }
        
        // Draw layer label
        networkCtx.fillStyle = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-primary').trim() || '#000';
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
    
    if (networkCtx) {
        networkCtx.clearRect(0, 0, networkCanvas.width, networkCanvas.height);
    }
    if (lossChartCtx) {
        lossChartCtx.clearRect(0, 0, lossChartCanvas.width, lossChartCanvas.height);
    }
    
    document.getElementById('currentEpoch').textContent = '0';
    document.getElementById('currentLoss').textContent = '-';
    document.getElementById('currentAccuracy').textContent = '-';
    document.getElementById('backpropViz').innerHTML = '<p>Start training to see gradients flow backward through the network!</p>';
    
    updateStatus('Network reset. Add layers to begin building!');
}

async function trainNetwork() {
    if (networkLayers.length < 2) {
        updateStatus('❌ Add at least input and output layers!');
        return;
    }
    
    if (isTraining) {
        updateStatus('⏸️ Training already in progress...');
        return;
    }
    
    isTraining = true;
    document.getElementById('trainBtn').disabled = true;
    
    const dataset = document.getElementById('datasetSelect').value;
    const learningRate = parseFloat(document.getElementById('learningRate').value);
    const epochs = parseInt(document.getElementById('epochs').value);
    
    trainingData = datasets[dataset];
    trainingHistory = [];
    
    updateStatus(`🚀 Training on ${trainingData.name}...`);
    
    // Simulate training with visualization
    for (let epoch = 0; epoch < epochs; epoch++) {
        // Simulate loss decreasing
        const loss = Math.max(0.01, 2 * Math.exp(-epoch / (epochs / 3)) + Math.random() * 0.1);
        const accuracy = Math.min(0.99, 1 - loss + Math.random() * 0.05);
        
        trainingHistory.push({ epoch: epoch + 1, loss: loss });
        
        // Update displays
        document.getElementById('currentEpoch').textContent = epoch + 1;
        document.getElementById('currentLoss').textContent = loss.toFixed(4);
        document.getElementById('currentAccuracy').textContent = (accuracy * 100).toFixed(1) + '%';
        
        // Update visualizations every 5 epochs
        if (epoch % 5 === 0) {
            drawLossChart();
            visualizeBackprop(epoch);
            highlightNetworkFlow();
        }
        
        // Delay for visualization (shorter delay for faster training)
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Check if user wants to stop
        if (!isTraining) break;
    }
    
    isTraining = false;
    document.getElementById('trainBtn').disabled = false;
    updateStatus(`✅ Training complete! Final accuracy: ${(Math.random() * 10 + 90).toFixed(1)}%`);
}

function drawLossChart() {
    if (!lossChartCtx || trainingHistory.length === 0) return;
    
    const canvas = lossChartCanvas;
    const ctx = lossChartCtx;
    const width = canvas.width;
    const height = canvas.height;
    const padding = 30;
    
    ctx.clearRect(0, 0, width, height);
    
    // Get colors from CSS variables
    const primaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--text-primary').trim() || '#000';
    const tertiaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--text-tertiary').trim() || '#666';
    
    // Draw axes
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = primaryColor;
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Epoch', width / 2, height - 5);
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Loss', 0, 0);
    ctx.restore();
    
    // Plot data
    if (trainingHistory.length > 1) {
        const maxEpoch = trainingHistory[trainingHistory.length - 1].epoch;
        const maxLoss = Math.max(...trainingHistory.map(d => d.loss));
        
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        trainingHistory.forEach((point, i) => {
            const x = padding + (point.epoch / maxEpoch) * (width - 2 * padding);
            const y = height - padding - (point.loss / maxLoss) * (height - 2 * padding);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw points
        ctx.fillStyle = primaryColor;
        trainingHistory.forEach(point => {
            const x = padding + (point.epoch / maxEpoch) * (width - 2 * padding);
            const y = height - padding - (point.loss / maxLoss) * (height - 2 * padding);
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

function visualizeBackprop(epoch) {
    const backpropDiv = document.getElementById('backpropViz');
    
    const gradients = [];
    for (let i = networkLayers.length - 1; i >= 0; i--) {
        const layer = networkLayers[i];
        const gradient = (Math.random() * 0.5 + 0.5) * Math.exp(-epoch / 50);
        gradients.push({
            layer: layer.type,
            gradient: gradient.toFixed(4)
        });
    }
    
    backpropDiv.innerHTML = `
        <div class="gradient-flow">
            ${gradients.map(g => `
                <div class="gradient-layer">
                    <strong>${g.layer}:</strong> ∇L = ${g.gradient}
                </div>
            `).join('')}
        </div>
    `;
}

function highlightNetworkFlow() {
    // Briefly highlight the network during training
    drawNetwork();
    
    networkCtx.globalAlpha = 0.1;
    networkLayers.forEach(layer => {
        for (let i = 0; i < layer.neurons; i++) {
            const y = getNeuronY(layer, i);
            networkCtx.beginPath();
            networkCtx.arc(layer.x, y, 20, 0, Math.PI * 2);
            networkCtx.fillStyle = getComputedStyle(document.documentElement)
                .getPropertyValue('--text-primary').trim() || '#000';
            networkCtx.fill();
        }
    });
    networkCtx.globalAlpha = 1.0;
}

function updateStatus(message) {
    const statusDiv = document.getElementById('trainingStatus');
    if (statusDiv) {
        statusDiv.innerHTML = `<p>${message}</p>`;
    }
}


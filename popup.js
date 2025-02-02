// Productivity Pal Popup Script

class ProductivityPal {
  constructor() {
    this.state = {
      timer: {
        duration: 25 * 60, // 25 minutes in seconds
        remaining: 25 * 60,
        isRunning: false,
        interval: null
      },
      tasks: [],
      focusHistory: {},
      settings: {
        notificationSound: true,
        darkMode: false,
        autoStartBreaks: false,
        focusDuration: 25,
        breakDuration: 5
      }
    };

    this.initializeUI();
    this.loadData();
    this.setupEventListeners();
    this.initializeDarkMode();
    this.addButtonFeedback();
    this.initializeAIAssistant();
    this.initializeWellness();
    this.initializeVoiceCommands();
    this.initializeAdvancedAnalytics();
  }

  // UI Initialization
  initializeUI() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Modal controls
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeModals());
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
      document.getElementById('settingsModal').classList.add('active');
    });

    // Add task button
    document.getElementById('addTaskBtn').addEventListener('click', () => {
      document.getElementById('addTaskModal').classList.add('active');
    });

    // Timer controls
    document.getElementById('startTimer').addEventListener('click', () => this.toggleTimer());
    document.getElementById('resetTimer').addEventListener('click', () => this.resetTimer());

    // Forms
    document.getElementById('addTaskForm').addEventListener('submit', (e) => this.handleAddTask(e));
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());

    // Initialize Chart.js
    this.initializeCharts();
  }

  // Data Management
  async loadData() {
    const data = await chrome.storage.local.get(null);
    if (data.tasks) this.state.tasks = data.tasks;
    if (data.focusHistory) this.state.focusHistory = data.focusHistory;
    if (data.settings) this.state.settings = { ...this.state.settings, ...data.settings };

    this.updateTaskList();
    this.updateStats();
    this.applySettings();
  }

  async saveData() {
    await chrome.storage.local.set({
      tasks: this.state.tasks,
      focusHistory: this.state.focusHistory,
      settings: this.state.settings
    });
  }

  // Timer Functions
  toggleTimer() {
    const startBtn = document.getElementById('startTimer');
    
    if (this.state.timer.isRunning) {
      this.pauseTimer();
      startBtn.innerHTML = '<i class="fas fa-play"></i> Start Focus';
    } else {
      this.startTimer();
      startBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
    }
  }

  startTimer() {
    this.state.timer.isRunning = true;
    
    // Send message to background script to start focus mode
    chrome.runtime.sendMessage({ 
      action: 'toggleFocusMode',
      value: true
    });

    this.state.timer.interval = setInterval(() => {
      this.state.timer.remaining--;
      this.updateTimerDisplay();

      if (this.state.timer.remaining <= 0) {
        this.completeTimer();
      }
    }, 1000);
  }

  pauseTimer() {
    this.state.timer.isRunning = false;
    clearInterval(this.state.timer.interval);
    
    // Send message to background script to pause focus mode
    chrome.runtime.sendMessage({ 
      action: 'toggleFocusMode',
      value: false
    });
  }

  resetTimer() {
    this.pauseTimer();
    this.state.timer.remaining = this.state.timer.duration;
    this.updateTimerDisplay();
    document.getElementById('startTimer').innerHTML = '<i class="fas fa-play"></i> Start Focus';
  }

  completeTimer() {
    this.pauseTimer();
    this.playNotificationSound();
    this.showNotification('Focus Session Complete', 'Great job! Take a break.');
    
    if (this.state.settings.autoStartBreaks) {
      this.startBreak();
    } else {
      this.resetTimer();
    }
  }

  startBreak() {
    this.state.timer.duration = this.state.settings.breakDuration * 60;
    this.state.timer.remaining = this.state.timer.duration;
    this.updateTimerDisplay();
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.state.timer.remaining / 60);
    const seconds = this.state.timer.remaining % 60;
    document.getElementById('timeDisplay').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // Task Management
  handleAddTask(e) {
    e.preventDefault();
    
    const task = {
      id: Date.now().toString(),
      title: document.getElementById('taskTitle').value,
      description: document.getElementById('taskDescription').value,
      dueDate: document.getElementById('taskDueDate').value,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.state.tasks.unshift(task);
    this.saveData();
    this.updateTaskList();
    this.closeModals();
    e.target.reset();
  }

  updateTaskList() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';

    this.state.tasks.forEach(task => {
      const taskElement = document.createElement('div');
      taskElement.className = 'task-item';
      taskElement.innerHTML = `
        <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
             data-id="${task.id}"></div>
        <div class="task-content">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            ${task.description ? `<span>${task.description}</span>` : ''}
            ${task.dueDate ? `<span><i class="fas fa-calendar"></i> ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          <button class="task-btn delete-task" data-id="${task.id}">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;

      taskList.appendChild(taskElement);
    });

    // Add event listeners to new elements
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('click', () => this.toggleTask(checkbox.dataset.id));
    });

    document.querySelectorAll('.delete-task').forEach(btn => {
      btn.addEventListener('click', () => this.deleteTask(btn.dataset.id));
    });
  }

  toggleTask(taskId) {
    const task = this.state.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = !task.completed;
      this.saveData();
      this.updateTaskList();
      this.updateStats();
    }
  }

  deleteTask(taskId) {
    this.state.tasks = this.state.tasks.filter(t => t.id !== taskId);
    this.saveData();
    this.updateTaskList();
    this.updateStats();
  }

  // Statistics and Charts
  updateStats() {
    // Update focus time
    const today = new Date().toISOString().split('T')[0];
    const focusTimeToday = this.state.focusHistory[today] || 0;
    document.getElementById('focusTimeToday').textContent = `${Math.round(focusTimeToday)}m`;

    // Update tasks completed
    const completedTasks = this.state.tasks.filter(t => t.completed).length;
    document.getElementById('tasksCompleted').textContent = completedTasks;

    // Update charts
    this.updateCharts();
  }

  initializeCharts() {
    const ctx = document.getElementById('focusHistory').getContext('2d');
    this.focusChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Focus Time (minutes)',
          data: [],
          borderColor: '#6366f1',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  updateCharts() {
    // Update focus history chart
    const dates = Object.keys(this.state.focusHistory).sort();
    const focusTimes = dates.map(date => this.state.focusHistory[date]);

    this.focusChart.data.labels = dates.map(date => 
      new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
    this.focusChart.data.datasets[0].data = focusTimes;
    this.focusChart.update();
  }

  // Settings Management
  saveSettings() {
    this.state.settings = {
      notificationSound: document.getElementById('notificationSound').checked,
      darkMode: document.getElementById('darkMode').checked,
      autoStartBreaks: document.getElementById('autoStartBreaks').checked,
      focusDuration: parseInt(document.getElementById('focusDuration').value),
      breakDuration: parseInt(document.getElementById('breakDuration').value)
    };

    this.saveData();
    this.applySettings();
    this.closeModals();
  }

  applySettings() {
    // Apply settings to UI
    document.getElementById('notificationSound').checked = this.state.settings.notificationSound;
    document.getElementById('darkMode').checked = this.state.settings.darkMode;
    document.getElementById('autoStartBreaks').checked = this.state.settings.autoStartBreaks;
    document.getElementById('focusDuration').value = this.state.settings.focusDuration;
    document.getElementById('breakDuration').value = this.state.settings.breakDuration;

    // Apply dark mode
    if (this.state.settings.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    // Update timer duration
    this.state.timer.duration = this.state.settings.focusDuration * 60;
    if (!this.state.timer.isRunning) {
      this.state.timer.remaining = this.state.timer.duration;
      this.updateTimerDisplay();
    }
  }

  // Utility Functions
  switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = content.id === `${tabId}Tab` ? 'block' : 'none';
    });
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('active');
    });
  }

  playNotificationSound() {
    if (this.state.settings.notificationSound) {
      const audio = new Audio(chrome.runtime.getURL('notification.mp3'));
      audio.play().catch(console.error);
    }
  }

  showNotification(title, message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority: 1
    });
  }

  // Dark mode toggle
  initializeDarkMode() {
    const darkModeToggle = document.querySelector('#darkModeToggle');
    if (darkModeToggle) {
      // Load saved preference
      chrome.storage.local.get(['darkMode'], (result) => {
        const isDarkMode = result.darkMode || false;
        document.body.classList.toggle('dark-mode', isDarkMode);
        darkModeToggle.checked = isDarkMode;
      });

      // Handle toggle
      darkModeToggle.addEventListener('change', (e) => {
        const isDarkMode = e.target.checked;
        document.body.classList.toggle('dark-mode', isDarkMode);
        chrome.storage.local.set({ darkMode: isDarkMode });
      });
    }
  }

  // Productivity ring
  updateProductivityRing(percentage) {
    const ring = document.querySelector('.productivity-ring');
    if (ring) {
      const circumference = 2 * Math.PI * 54; // radius = 54
      const offset = circumference - (percentage / 100) * circumference;
      const ringValue = ring.querySelector('.ring-value');
      const ringLabel = ring.querySelector('.ring-label');
      
      ringValue.style.strokeDasharray = `${circumference} ${circumference}`;
      ringValue.style.strokeDashoffset = offset;
      ringLabel.textContent = `${Math.round(percentage)}%`;
    }
  }

  // Task priority handling
  addTaskWithPriority(taskText, priority = 'medium') {
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    
    const priorityIndicator = document.createElement('div');
    priorityIndicator.className = `priority-indicator priority-${priority}`;
    priorityIndicator.setAttribute('data-tooltip', `Priority: ${priority}`);
    
    taskItem.appendChild(priorityIndicator);
    // ... rest of task creation code
  }

  // Progress bar animation
  updateProgressBar(percentage) {
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
      const progressValue = progressBar.querySelector('.progress-value');
      progressValue.style.width = `${percentage}%`;
    }
  }

  // Enhanced button feedback
  addButtonFeedback() {
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 1000);
      });
    });
  }

  // Focus mode animation
  toggleFocusAnimation(active) {
    const timerDisplay = document.querySelector('.timer-display');
    if (timerDisplay) {
      timerDisplay.classList.toggle('focus-active', active);
    }
  }

  // AI Assistant functionality
  initializeAIAssistant() {
    this.aiAssistant = new AIAssistant();
    const aiInput = document.querySelector('#aiInput');
    const aiSendBtn = document.querySelector('#aiSendBtn');
    const aiVoiceBtn = document.querySelector('#aiVoiceBtn');
    const suggestionChips = document.querySelectorAll('.suggestion-chip');

    if (aiInput && aiSendBtn) {
      aiSendBtn.addEventListener('click', () => {
        const query = aiInput.value.trim();
        if (query) {
          this.handleAIRequest(query);
          aiInput.value = '';
        }
      });

      aiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const query = aiInput.value.trim();
          if (query) {
            this.handleAIRequest(query);
            aiInput.value = '';
          }
        }
      });
    }

    if (aiVoiceBtn) {
      aiVoiceBtn.addEventListener('click', () => {
        this.startVoiceRecognition();
      });
    }

    // Initialize suggestion chips
    suggestionChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const command = chip.dataset.command;
        if (command) {
          this.handleAIRequest(command);
        }
      });
    });
  }

  async handleAIRequest(query) {
    // Add user message to chat
    this.addChatMessage('user', query);

    try {
      // Process the request through AI Assistant
      const response = await this.aiAssistant.processCommand(query);
      
      // Handle the response based on its type
      switch (response.type) {
        case 'reminder':
          this.handleReminderResponse(response);
          break;
        case 'task':
          this.handleTaskResponse(response);
          break;
        case 'focus':
          this.handleFocusResponse(response);
          break;
        case 'break':
          this.handleBreakResponse(response);
          break;
        case 'status':
          this.handleStatusResponse(response);
          break;
        default:
          this.addChatMessage('assistant', response.message);
      }
    } catch (error) {
      console.error('AI Assistant Error:', error);
      this.addChatMessage('assistant', 'Sorry, I encountered an error. Please try again.');
    }
  }

  addChatMessage(type, message) {
    const chatWindow = document.querySelector('#aiChatWindow');
    if (!chatWindow) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}-message`;
    
    // Add emoji based on message type
    const emoji = type === 'user' ? '👤' : '🤖';
    messageDiv.innerHTML = `<span class="message-emoji">${emoji}</span> ${message}`;
    
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  handleReminderResponse(response) {
    this.addChatMessage('assistant', response.message);
    this.scheduleReminder(response.data);
  }

  handleTaskResponse(response) {
    this.addChatMessage('assistant', response.message);
    this.addTask(response.data.text, response.data.priority, response.data.category);
  }

  handleFocusResponse(response) {
    this.addChatMessage('assistant', response.message);
    this.startTimer(response.data.duration);
  }

  handleBreakResponse(response) {
    this.addChatMessage('assistant', response.message);
    this.startBreak(response.data.duration);
  }

  handleStatusResponse(response) {
    this.addChatMessage('assistant', response.message);
    // Update UI with stats if needed
    if (response.data) {
      this.updateProductivityStats(response.data);
    }
  }

  scheduleReminder(reminder) {
    chrome.alarms.create(`reminder-${Date.now()}`, {
      when: new Date(reminder.time).getTime()
    });

    chrome.storage.local.get(['reminders'], (result) => {
      const reminders = result.reminders || [];
      reminders.push(reminder);
      chrome.storage.local.set({ reminders });
    });
  }

  startVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
      this.addChatMessage('assistant', 'Sorry, voice recognition is not supported in your browser.');
      return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      this.addChatMessage('assistant', 'Listening... Speak your command.');
      const aiVoiceBtn = document.querySelector('#aiVoiceBtn');
      if (aiVoiceBtn) {
        aiVoiceBtn.classList.add('listening');
      }
    };

    recognition.onresult = (event) => {
      const command = event.results[0][0].transcript;
      this.handleAIRequest(command);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.addChatMessage('assistant', 'Sorry, I couldn\'t understand that. Please try again.');
    };

    recognition.onend = () => {
      const aiVoiceBtn = document.querySelector('#aiVoiceBtn');
      if (aiVoiceBtn) {
        aiVoiceBtn.classList.remove('listening');
      }
    };

    recognition.start();
  }

  updateProductivityStats(stats) {
    // Update UI elements with the new stats
    if (stats.focusMinutes) {
      const focusElement = document.querySelector('#focusTime');
      if (focusElement) {
        focusElement.textContent = `${Math.round(stats.focusMinutes)} min`;
      }
    }

    if (stats.completedTasks) {
      const tasksElement = document.querySelector('#completedTasks');
      if (tasksElement) {
        tasksElement.textContent = stats.completedTasks;
      }
    }
  }

  // Wellness tracking
  initializeWellness() {
    const moodButtons = document.querySelectorAll('.mood-btn');
    const exerciseCards = document.querySelectorAll('.exercise-card');

    moodButtons.forEach(btn => {
      btn.addEventListener('click', () => this.handleMoodSelection(btn.dataset.mood));
    });

    exerciseCards.forEach(card => {
      card.addEventListener('click', () => this.startExercise(card.dataset.exercise));
    });

    // Initialize mood chart
    this.initializeMoodChart();
    this.updateWellnessInsights();
  }

  handleMoodSelection(mood) {
    const timestamp = new Date().toISOString();
    const moodData = { mood, timestamp };

    chrome.storage.local.get(['moodHistory'], (result) => {
      const moodHistory = result.moodHistory || [];
      moodHistory.push(moodData);
      chrome.storage.local.set({ moodHistory }, () => {
        this.updateMoodChart();
        this.updateWellnessInsights();
        this.showNotification('Mood tracked! Keep up the good work!');
      });
    });
  }

  initializeMoodChart() {
    const ctx = document.querySelector('.wellness-chart').getContext('2d');
    this.moodChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Mood Trend',
          data: [],
          borderColor: '#6366f1',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 5
          }
        }
      }
    });
  }

  updateMoodChart() {
    chrome.storage.local.get(['moodHistory'], (result) => {
      const moodHistory = result.moodHistory || [];
      const moodValues = {
        'great': 5,
        'good': 4,
        'okay': 3,
        'stressed': 2,
        'exhausted': 1
      };

      const labels = moodHistory.slice(-7).map(entry => 
        new Date(entry.timestamp).toLocaleDateString()
      );
      const data = moodHistory.slice(-7).map(entry => moodValues[entry.mood]);

      this.moodChart.data.labels = labels;
      this.moodChart.data.datasets[0].data = data;
      this.moodChart.update();
    });
  }

  updateWellnessInsights() {
    chrome.storage.local.get(['moodHistory', 'focusHistory'], (result) => {
      const moodHistory = result.moodHistory || [];
      const focusHistory = result.focusHistory || [];
      const insights = this.generateWellnessInsights(moodHistory, focusHistory);
      
      const insightsContainer = document.querySelector('#wellnessInsights');
      insightsContainer.innerHTML = insights.map(insight => 
        `<div class="insight-item">${insight}</div>`
      ).join('');
    });
  }

  generateWellnessInsights(moodHistory, focusHistory) {
    const insights = [];
    const recentMoods = moodHistory.slice(-7);
    const averageMood = this.calculateAverageMood(recentMoods);

    if (averageMood < 3) {
      insights.push('Consider taking more breaks and trying our mindfulness exercises.');
    } else if (averageMood >= 4) {
      insights.push('Great job maintaining positive energy! Keep up the momentum!');
    }

    // Add focus-related insights
    const todaysFocus = focusHistory.filter(entry => 
      new Date(entry.timestamp).toDateString() === new Date().toDateString()
    );

    if (todaysFocus.length > 0) {
      const totalFocusTime = todaysFocus.reduce((acc, curr) => acc + curr.duration, 0);
      if (totalFocusTime > 240) { // More than 4 hours
        insights.push('Remember to take regular breaks to maintain this great focus!');
      }
    }

    return insights;
  }

  startExercise(type) {
    let exercise;
    switch (type) {
      case 'breathing':
        exercise = {
          title: 'Box Breathing',
          steps: [
            'Inhale for 4 seconds',
            'Hold for 4 seconds',
            'Exhale for 4 seconds',
            'Hold for 4 seconds'
          ],
          duration: 300 // 5 minutes
        };
        break;
      case 'meditation':
        exercise = {
          title: 'Quick Meditation',
          steps: [
            'Find a comfortable position',
            'Close your eyes',
            'Focus on your breath',
            'Let thoughts pass by'
          ],
          duration: 180 // 3 minutes
        };
        break;
      case 'stretch':
        exercise = {
          title: 'Desk Stretches',
          steps: [
            'Shoulder rolls',
            'Neck stretches',
            'Wrist rotations',
            'Back twists'
          ],
          duration: 120 // 2 minutes
        };
        break;
    }

    this.showExerciseModal(exercise);
  }

  showExerciseModal(exercise) {
    // Create and show modal for exercise
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${exercise.title}</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="exercise-timer">${Math.floor(exercise.duration / 60)}:00</div>
          <div class="exercise-steps">
            ${exercise.steps.map((step, index) => 
              `<div class="exercise-step" data-step="${index + 1}">${step}</div>`
            ).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.startExerciseTimer(modal, exercise.duration);
  }

  startExerciseTimer(modal, duration) {
    let timeLeft = duration;
    const timerDisplay = modal.querySelector('.exercise-timer');
    const timer = setInterval(() => {
      timeLeft--;
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      if (timeLeft <= 0) {
        clearInterval(timer);
        this.showNotification('Exercise completed! Great job!');
        modal.remove();
      }
    }, 1000);

    modal.querySelector('.close-btn').addEventListener('click', () => {
      clearInterval(timer);
      modal.remove();
    });
  }

  // Voice Command System
  initializeVoiceCommands() {
    const voiceBtn = document.querySelector('#voiceCommandBtn');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => this.startVoiceRecognition());
    }

    // Initialize speech recognition
    this.recognition = new webkitSpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      const command = event.results[0][0].transcript;
      this.handleVoiceCommand(command);
    };
  }

  startVoiceRecognition() {
    this.showNotification('Listening...', 'Say a command');
    this.recognition.start();
  }

  handleVoiceCommand(command) {
    const cmd = command.toLowerCase();
    
    if (cmd.includes('start timer') || cmd.includes('start focus')) {
      this.startTimer();
      this.respondToVoice('Timer started');
    } else if (cmd.includes('stop timer') || cmd.includes('stop focus')) {
      this.stopTimer();
      this.respondToVoice('Timer stopped');
    } else if (cmd.includes('add task')) {
      const taskText = command.replace(/add task|add a task/i, '').trim();
      this.addTask(taskText);
      this.respondToVoice(`Task added: ${taskText}`);
    } else if (cmd.includes('start break')) {
      this.startBreak();
      this.respondToVoice('Break started');
    } else if (cmd.includes('how am i doing')) {
      this.provideVoiceUpdate();
    }
  }

  respondToVoice(message) {
    const speech = new SpeechSynthesisUtterance(message);
    window.speechSynthesis.speak(speech);
  }

  provideVoiceUpdate() {
    chrome.storage.local.get(['focusHistory', 'taskHistory', 'moodHistory'], (result) => {
      const todaysFocus = this.getTodaysFocusTime(result.focusHistory || []);
      const completedTasks = this.getTodaysCompletedTasks(result.taskHistory || []);
      const currentMood = this.getCurrentMood(result.moodHistory || []);

      const update = `Today you've focused for ${Math.round(todaysFocus / 60)} minutes and completed ${completedTasks} tasks. Your current mood seems ${currentMood}.`;
      this.respondToVoice(update);
    });
  }

  // Advanced Analytics
  initializeAdvancedAnalytics() {
    this.updateProductivityScore();
    this.generateProductivityInsights();
    this.updateHeatmap();
  }

  updateProductivityScore() {
    chrome.storage.local.get(['focusHistory', 'taskHistory', 'moodHistory'], (result) => {
      const focusScore = this.calculateFocusScore(result.focusHistory || []);
      const taskScore = this.calculateTaskScore(result.taskHistory || []);
      const wellnessScore = this.calculateWellnessScore(result.moodHistory || []);

      const totalScore = (focusScore + taskScore + wellnessScore) / 3;
      this.updateProductivityRing(totalScore);

      // Update insights
      const insights = this.generateProductivityInsights(focusScore, taskScore, wellnessScore);
      this.displayInsights(insights);
    });
  }

  calculateFocusScore(history) {
    const recentHistory = history.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return entryDate >= weekAgo;
    });

    if (recentHistory.length === 0) return 0;

    const totalFocusTime = recentHistory.reduce((acc, curr) => acc + curr.duration, 0);
    const dailyAverage = totalFocusTime / 7 / 60; // in hours
    return Math.min((dailyAverage / 8) * 100, 100); // 8 hours is considered 100%
  }

  calculateTaskScore(history) {
    const recentTasks = history.filter(task => {
      const taskDate = new Date(task.timestamp);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return taskDate >= weekAgo;
    });

    if (recentTasks.length === 0) return 0;

    const completedTasks = recentTasks.filter(task => task.completed).length;
    const completionRate = (completedTasks / recentTasks.length) * 100;
    return completionRate;
  }

  calculateWellnessScore(history) {
    if (!history.length) return 0;

    const recentMoods = history.slice(-7);
    const moodValues = {
      'great': 100,
      'good': 80,
      'okay': 60,
      'stressed': 40,
      'exhausted': 20
    };

    const averageMood = recentMoods.reduce((acc, curr) => 
      acc + moodValues[curr.mood], 0) / recentMoods.length;
    
    return averageMood;
  }

  generateProductivityInsights(focusScore, taskScore, wellnessScore) {
    const insights = [];

    // Focus insights
    if (focusScore < 50) {
      insights.push({
        type: 'focus',
        message: 'Try breaking your work into smaller, focused sessions',
        action: 'Start with 25-minute focus sessions'
      });
    } else if (focusScore > 80) {
      insights.push({
        type: 'focus',
        message: 'Excellent focus habits! Keep up the great work',
        action: 'Consider increasing session lengths'
      });
    }

    // Task insights
    if (taskScore < 50) {
      insights.push({
        type: 'tasks',
        message: 'Task completion rate is low. Let\'s improve organization',
        action: 'Try prioritizing tasks with the MoSCoW method'
      });
    } else if (taskScore > 80) {
      insights.push({
        type: 'tasks',
        message: 'Great task management! You\'re very productive',
        action: 'Challenge yourself with more complex projects'
      });
    }

    // Wellness insights
    if (wellnessScore < 50) {
      insights.push({
        type: 'wellness',
        message: 'Your wellness score indicates high stress',
        action: 'Take regular breaks and try our mindfulness exercises'
      });
    } else if (wellnessScore > 80) {
      insights.push({
        type: 'wellness',
        message: 'You\'re maintaining a great work-life balance',
        action: 'Share your wellness routine with the community'
      });
    }

    return insights;
  }

  updateHeatmap() {
    const heatmapCanvas = document.querySelector('#productivityHeatmap');
    if (!heatmapCanvas) return;

    chrome.storage.local.get(['focusHistory'], (result) => {
      const ctx = heatmapCanvas.getContext('2d');
      const history = result.focusHistory || [];
      
      // Create 7x24 grid for week's hourly productivity
      const data = this.processHeatmapData(history);
      this.renderHeatmap(ctx, data);
    });
  }

  processHeatmapData(history) {
    const data = Array(7).fill().map(() => Array(24).fill(0));
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    history.forEach(entry => {
      const date = new Date(entry.timestamp);
      if (date >= weekAgo) {
        const day = date.getDay();
        const hour = date.getHours();
        data[day][hour] += entry.duration / 60; // Convert to hours
      }
    });

    return data;
  }

  renderHeatmap(ctx, data) {
    const cellSize = 20;
    const maxValue = Math.max(...data.flat());

    data.forEach((row, i) => {
      row.forEach((value, j) => {
        const intensity = value / maxValue;
        const color = this.getHeatmapColor(intensity);
        
        ctx.fillStyle = color;
        ctx.fillRect(j * cellSize, i * cellSize, cellSize - 1, cellSize - 1);
      });
    });
  }

  getHeatmapColor(intensity) {
    const h = (1 - intensity) * 240; // Blue to Red
    return `hsl(${h}, 70%, 50%)`;
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  window.productivityPal = new ProductivityPal();
});

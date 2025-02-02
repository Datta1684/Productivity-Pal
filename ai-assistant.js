class AIAssistant {
  constructor() {
    this.nlpPatterns = {
      reminder: /remind\s+me\s+to\s+(.+?)\s+(?:at|on|in)\s+(.+)/i,
      task: /add\s+(?:a\s+)?task\s+(.+)/i,
      focus: /start\s+(?:a\s+)?focus\s+session\s+(?:for\s+)?(\d+)?\s*(?:minutes)?/i,
      break: /take\s+(?:a\s+)?break\s+(?:for\s+)?(\d+)?\s*(?:minutes)?/i,
      status: /how\s+(?:am\s+)?i\s+doing/i
    };
  }

  async processCommand(text) {
    let response = {
      type: 'unknown',
      action: null,
      message: 'I didn\'t understand that command. Try asking me to add a task, set a reminder, or start a focus session.'
    };

    // Check each pattern
    for (const [type, pattern] of Object.entries(this.nlpPatterns)) {
      const match = text.match(pattern);
      if (match) {
        response = await this.handleCommand(type, match);
        break;
      }
    }

    return response;
  }

  async handleCommand(type, match) {
    switch (type) {
      case 'reminder':
        return this.handleReminder(match[1], match[2]);
      case 'task':
        return this.handleTask(match[1]);
      case 'focus':
        return this.handleFocus(match[1]);
      case 'break':
        return this.handleBreak(match[1]);
      case 'status':
        return await this.handleStatus();
    }
  }

  async handleReminder(task, time) {
    const parsedTime = this.parseTime(time);
    if (!parsedTime) {
      return {
        type: 'error',
        message: 'I couldn\'t understand the time format. Try something like "tomorrow at 3 PM" or "in 2 hours".'
      };
    }

    const reminder = {
      task,
      time: parsedTime.toISOString(),
      created: new Date().toISOString()
    };

    await this.saveReminder(reminder);

    return {
      type: 'reminder',
      action: 'create',
      data: reminder,
      message: `I'll remind you to ${task} at ${parsedTime.toLocaleString()}`
    };
  }

  async handleTask(taskText) {
    // Analyze task priority and category
    const analysis = this.analyzeTask(taskText);
    
    const task = {
      text: taskText,
      priority: analysis.priority,
      category: analysis.category,
      created: new Date().toISOString(),
      completed: false
    };

    await this.saveTask(task);

    return {
      type: 'task',
      action: 'create',
      data: task,
      message: `Added task: ${taskText} (${analysis.priority} priority, ${analysis.category})`
    };
  }

  analyzeTask(text) {
    // Simple keyword-based analysis
    const urgentKeywords = ['urgent', 'asap', 'important', 'critical'];
    const workKeywords = ['work', 'project', 'meeting', 'deadline', 'report'];
    const personalKeywords = ['personal', 'home', 'family', 'hobby', 'exercise'];
    
    const textLower = text.toLowerCase();
    
    // Determine priority
    const priority = urgentKeywords.some(keyword => textLower.includes(keyword)) 
      ? 'high' 
      : textLower.includes('later') ? 'low' : 'medium';

    // Determine category
    const category = workKeywords.some(keyword => textLower.includes(keyword))
      ? 'work'
      : personalKeywords.some(keyword => textLower.includes(keyword))
      ? 'personal'
      : 'general';

    return { priority, category };
  }

  async handleFocus(duration) {
    const focusDuration = duration ? parseInt(duration) : 25; // Default to 25 minutes
    
    return {
      type: 'focus',
      action: 'start',
      data: { duration: focusDuration },
      message: `Starting a ${focusDuration}-minute focus session. I'll help you stay focused!`
    };
  }

  async handleBreak(duration) {
    const breakDuration = duration ? parseInt(duration) : 5; // Default to 5 minutes
    
    return {
      type: 'break',
      action: 'start',
      data: { duration: breakDuration },
      message: `Starting a ${breakDuration}-minute break. Time to recharge!`
    };
  }

  async handleStatus() {
    const stats = await this.getProductivityStats();
    
    return {
      type: 'status',
      action: 'report',
      data: stats,
      message: this.generateStatusMessage(stats)
    };
  }

  async getProductivityStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['focusHistory', 'taskHistory', 'moodHistory'], (result) => {
        const today = new Date().toDateString();
        
        const focusMinutes = this.calculateTodaysFocus(result.focusHistory || []);
        const completedTasks = this.calculateTodaysTasks(result.taskHistory || []);
        const currentMood = this.getCurrentMood(result.moodHistory || []);
        
        resolve({ focusMinutes, completedTasks, currentMood });
      });
    });
  }

  calculateTodaysFocus(history) {
    const today = new Date().toDateString();
    return history
      .filter(entry => new Date(entry.timestamp).toDateString() === today)
      .reduce((total, entry) => total + entry.duration, 0) / 60; // Convert to minutes
  }

  calculateTodaysTasks(history) {
    const today = new Date().toDateString();
    return history
      .filter(task => 
        new Date(task.timestamp).toDateString() === today && task.completed
      ).length;
  }

  getCurrentMood(history) {
    if (!history.length) return 'unknown';
    return history[history.length - 1].mood;
  }

  generateStatusMessage(stats) {
    let message = `Today you've focused for ${Math.round(stats.focusMinutes)} minutes `;
    message += `and completed ${stats.completedTasks} tasks. `;
    
    if (stats.currentMood !== 'unknown') {
      message += `Your current mood is ${stats.currentMood}. `;
    }

    // Add encouragement
    if (stats.focusMinutes > 120) {
      message += "You're having a very productive day! ";
    } else if (stats.focusMinutes < 30 && stats.completedTasks < 2) {
      message += "Let's set a goal to boost your productivity! ";
    }

    return message;
  }

  parseTime(timeStr) {
    const now = new Date();
    const lowerTimeStr = timeStr.toLowerCase();

    // Handle relative time
    if (lowerTimeStr.includes('in')) {
      const number = parseInt(timeStr.match(/\d+/)[0]);
      if (lowerTimeStr.includes('hour')) {
        now.setHours(now.getHours() + number);
      } else if (lowerTimeStr.includes('minute')) {
        now.setMinutes(now.getMinutes() + number);
      }
      return now;
    }

    // Handle "tomorrow at X"
    if (lowerTimeStr.includes('tomorrow')) {
      now.setDate(now.getDate() + 1);
      const timeMatch = timeStr.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
      if (timeMatch) {
        let hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const meridian = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

        if (meridian === 'pm' && hours < 12) hours += 12;
        if (meridian === 'am' && hours === 12) hours = 0;

        now.setHours(hours, minutes, 0, 0);
      }
      return now;
    }

    // Handle specific time today
    const timeMatch = timeStr.match(/(\d+)(?::(\d+))?\s*(am|pm)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const meridian = timeMatch[3].toLowerCase();

      if (meridian === 'pm' && hours < 12) hours += 12;
      if (meridian === 'am' && hours === 12) hours = 0;

      now.setHours(hours, minutes, 0, 0);

      // If the time has already passed today, assume tomorrow
      if (now < new Date()) {
        now.setDate(now.getDate() + 1);
      }

      return now;
    }

    return null;
  }

  async saveReminder(reminder) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['reminders'], (result) => {
        const reminders = result.reminders || [];
        reminders.push(reminder);
        chrome.storage.local.set({ reminders }, resolve);
      });
    });
  }

  async saveTask(task) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['tasks'], (result) => {
        const tasks = result.tasks || [];
        tasks.push(task);
        chrome.storage.local.set({ tasks }, resolve);
      });
    });
  }
}

// Export for use in popup.js
window.AIAssistant = AIAssistant;

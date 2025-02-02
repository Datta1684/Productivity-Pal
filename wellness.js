class WellnessTracker {
  constructor() {
    this.moodEmojis = {
      'great': '😊',
      'good': '🙂',
      'neutral': '😐',
      'stressed': '😓',
      'overwhelmed': '😫'
    };
    
    this.stressIndicators = {
      rapidTaskSwitching: 0,
      longWorkPeriods: 0,
      breakSkipping: 0,
      lateHoursWork: 0
    };
  }

  async trackMood(mood, notes = '') {
    const moodEntry = {
      mood,
      emoji: this.moodEmojis[mood],
      timestamp: new Date().toISOString(),
      notes,
      stressLevel: await this.calculateStressLevel(),
      workPattern: await this.getWorkPattern()
    };

    return new Promise((resolve) => {
      chrome.storage.local.get(['moodHistory'], (result) => {
        const moodHistory = result.moodHistory || [];
        moodHistory.push(moodEntry);
        chrome.storage.local.set({ moodHistory }, () => resolve(moodEntry));
      });
    });
  }

  async calculateStressLevel() {
    const workPatterns = await this.getWorkPattern();
    let stressScore = 0;

    // Analyze work duration
    if (workPatterns.averageSessionLength > 120) { // 2 hours
      stressScore += 2;
      this.stressIndicators.longWorkPeriods++;
    }

    // Analyze break patterns
    if (workPatterns.breakSkipRate > 0.3) { // Skipping more than 30% of recommended breaks
      stressScore += 2;
      this.stressIndicators.breakSkipping++;
    }

    // Analyze time of day
    const currentHour = new Date().getHours();
    if (currentHour < 6 || currentHour > 22) { // Working very early or late
      stressScore += 1;
      this.stressIndicators.lateHoursWork++;
    }

    // Analyze task switching
    if (workPatterns.taskSwitchRate > 10) { // More than 10 task switches per hour
      stressScore += 1;
      this.stressIndicators.rapidTaskSwitching++;
    }

    return {
      level: stressScore,
      indicators: this.stressIndicators
    };
  }

  async getWorkPattern() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['focusHistory', 'taskHistory'], (result) => {
        const focusHistory = result.focusHistory || [];
        const taskHistory = result.taskHistory || [];
        
        // Calculate metrics for the last 24 hours
        const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
        const recentFocus = focusHistory.filter(f => new Date(f.timestamp) > last24Hours);
        const recentTasks = taskHistory.filter(t => new Date(t.timestamp) > last24Hours);

        const workPattern = {
          averageSessionLength: this.calculateAverageSessionLength(recentFocus),
          breakSkipRate: this.calculateBreakSkipRate(recentFocus),
          taskSwitchRate: this.calculateTaskSwitchRate(recentTasks),
          productiveHours: this.identifyProductiveHours(recentFocus)
        };

        resolve(workPattern);
      });
    });
  }

  calculateAverageSessionLength(focusSessions) {
    if (!focusSessions.length) return 0;
    const totalDuration = focusSessions.reduce((sum, session) => sum + session.duration, 0);
    return totalDuration / focusSessions.length;
  }

  calculateBreakSkipRate(focusSessions) {
    if (!focusSessions.length) return 0;
    const skippedBreaks = focusSessions.filter(session => !session.breakTaken).length;
    return skippedBreaks / focusSessions.length;
  }

  calculateTaskSwitchRate(tasks) {
    if (!tasks.length) return 0;
    const timeRange = (new Date(tasks[tasks.length - 1].timestamp) - new Date(tasks[0].timestamp)) / (1000 * 60 * 60);
    return tasks.length / (timeRange || 1);
  }

  identifyProductiveHours(focusSessions) {
    const hourlyProductivity = Array(24).fill(0);
    
    focusSessions.forEach(session => {
      const hour = new Date(session.timestamp).getHours();
      hourlyProductivity[hour] += session.duration;
    });

    return hourlyProductivity;
  }

  getMindfulnessExercise(stressLevel) {
    const exercises = {
      low: [
        {
          name: 'Quick Breathing',
          duration: 2,
          description: 'Take 5 deep breaths, focusing on each inhale and exhale.',
          technique: 'box_breathing'
        }
      ],
      medium: [
        {
          name: 'Mindful Break',
          duration: 5,
          description: 'Close your eyes, focus on your breath, and let thoughts pass by like clouds.',
          technique: 'mindfulness'
        }
      ],
      high: [
        {
          name: 'Stress Relief',
          duration: 10,
          description: 'Find a quiet place. Progressive muscle relaxation from head to toe.',
          technique: 'progressive_relaxation'
        }
      ]
    };

    const level = stressLevel <= 2 ? 'low' : stressLevel <= 4 ? 'medium' : 'high';
    return exercises[level][Math.floor(Math.random() * exercises[level].length)];
  }

  async getWellnessRecommendations() {
    const stressLevel = await this.calculateStressLevel();
    const workPattern = await this.getWorkPattern();
    const recommendations = [];

    // Break recommendations
    if (workPattern.averageSessionLength > 90) {
      recommendations.push({
        type: 'break',
        priority: 'high',
        message: 'You\'ve been working for long stretches. Try taking more frequent breaks.'
      });
    }

    // Stress management
    if (stressLevel.level > 3) {
      recommendations.push({
        type: 'stress',
        priority: 'high',
        message: 'Your stress indicators are elevated. Consider a mindfulness exercise.',
        exercise: this.getMindfulnessExercise(stressLevel.level)
      });
    }

    // Work pattern optimization
    if (workPattern.taskSwitchRate > 8) {
      recommendations.push({
        type: 'focus',
        priority: 'medium',
        message: 'You\'re switching tasks frequently. Try grouping similar tasks together.'
      });
    }

    // Time management
    if (this.stressIndicators.lateHoursWork > 2) {
      recommendations.push({
        type: 'schedule',
        priority: 'medium',
        message: 'You\'re working late hours. Consider adjusting your schedule to work during your most productive times.'
      });
    }

    return recommendations;
  }

  startMindfulnessExercise(exercise) {
    return new Promise((resolve) => {
      let timeLeft = exercise.duration * 60; // Convert to seconds
      const timer = setInterval(() => {
        timeLeft--;
        
        // Update UI with remaining time
        const event = new CustomEvent('mindfulnessUpdate', {
          detail: {
            timeLeft,
            totalTime: exercise.duration * 60,
            exercise
          }
        });
        window.dispatchEvent(event);

        if (timeLeft <= 0) {
          clearInterval(timer);
          resolve();
        }
      }, 1000);
    });
  }

  async generateWellnessReport() {
    const moodHistory = await this.getMoodHistory();
    const workPattern = await this.getWorkPattern();
    const stressLevel = await this.calculateStressLevel();

    return {
      overview: {
        averageMood: this.calculateAverageMood(moodHistory),
        stressLevel: stressLevel.level,
        workLifeBalance: this.calculateWorkLifeBalance(workPattern)
      },
      patterns: {
        productiveHours: workPattern.productiveHours,
        breakPatterns: {
          taken: workPattern.breakSkipRate,
          recommended: 0.25 // 15 minutes every hour
        },
        stressIndicators: this.stressIndicators
      },
      recommendations: await this.getWellnessRecommendations()
    };
  }

  calculateAverageMood(moodHistory) {
    if (!moodHistory.length) return 'neutral';
    const moodValues = {
      'great': 5,
      'good': 4,
      'neutral': 3,
      'stressed': 2,
      'overwhelmed': 1
    };
    
    const sum = moodHistory.reduce((acc, entry) => acc + moodValues[entry.mood], 0);
    const average = sum / moodHistory.length;
    
    return Object.entries(moodValues)
      .reduce((closest, [mood, value]) => 
        Math.abs(value - average) < Math.abs(moodValues[closest] - average) 
          ? mood 
          : closest
      , 'neutral');
  }

  calculateWorkLifeBalance(workPattern) {
    const idealWorkHours = 8;
    const actualWorkHours = workPattern.productiveHours.reduce((sum, hours) => sum + hours, 0) / 60;
    
    if (actualWorkHours > idealWorkHours * 1.2) return 'overworked';
    if (actualWorkHours < idealWorkHours * 0.8) return 'underutilized';
    return 'balanced';
  }

  async getMoodHistory() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['moodHistory'], (result) => {
        resolve(result.moodHistory || []);
      });
    });
  }
}

// Export for use in popup.js
window.WellnessTracker = WellnessTracker;

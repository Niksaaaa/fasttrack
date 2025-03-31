document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const currentStateDisplay = document.getElementById('current-state');
    const timerDisplay = document.getElementById('timer-display');
    const hoursDisplay = document.getElementById('hours');
    const minutesDisplay = document.getElementById('minutes');
    const secondsDisplay = document.getElementById('seconds');
    const startTimeDisplay = document.getElementById('start-time-display');
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const historyList = document.getElementById('history-list');
    const noHistoryMsg = document.getElementById('no-history');
    const themeToggle = document.getElementById('themeToggle');
    const goalHoursInput = document.getElementById('goal-hours');
    const setGoalBtn = document.getElementById('set-goal-btn');
    const currentGoalDisplay = document.getElementById('current-goal-display');
    const progressContainer = document.getElementById('progress-container');
    const progressBarInner = document.getElementById('progress-bar-inner');
    const progressText = document.getElementById('progress-text');
    const notesInputArea = document.getElementById('notes-input-area');
    const fastNotesInput = document.getElementById('fast-notes');
    const chartSection = document.getElementById('chart-section');
    const historyChartCanvas = document.getElementById('historyChart');
    // REMOVED: const installAppButton = document.getElementById('install-app-button');

    // --- State variables ---
    let currentFastStartTime = null; // Timestamp (ms) when current fast started, or null
    let fastHistory = [];            // Array of completed fast objects
    let timerInterval = null;        // Holds the interval ID for the timer
    let currentGoalDuration = null;  // Target duration in milliseconds, or null
    let currentTheme = 'light';      // 'light' or 'dark'
    let historyChart = null;         // Chart.js instance
    // REMOVED: let deferredInstallPrompt = null;

    // --- Initialization ---
    loadState(); // Load theme first
    applyTheme(currentTheme);
    updateUI();
    registerServiceWorker(); // PWA setup

    // --- Event Listeners ---
    startBtn.addEventListener('click', startFast);
    stopBtn.addEventListener('click', stopFast);
    themeToggle.addEventListener('change', handleThemeToggle);
    setGoalBtn.addEventListener('click', setGoal);
    goalHoursInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') setGoal(); // Allow Enter to set goal
    });

    // --- PWA Service Worker ---
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js') // Make sure sw.js is at the root
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        }
    }

    // --- PWA Install Prompt Handling (Browser Default) ---
    // We are *not* preventing the default browser prompt here.
    // The browser will show its own UI when criteria are met.
    window.addEventListener('beforeinstallprompt', (event) => {
      // Optionally: Log that the browser is ready to prompt
      console.log('Browser install prompt available (beforeinstallprompt fired).');
      // We are NOT calling event.preventDefault()
      // We are NOT storing the event (deferredInstallPrompt = event;)
      // We are NOT showing our custom button (#install-app-button)
    });

    // Optional: Track installation success/dismissal
    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        // Optionally hide any custom promotion UI if you had one
    });


    // --- Theme Handling ---
    function handleThemeToggle() {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        applyTheme(newTheme);
        saveState();
    }

    function applyTheme(theme) {
        currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        themeToggle.checked = (theme === 'dark');
        // Update chart colors if chart exists
        if (historyChart) {
            updateChartAppearance();
            historyChart.update();
        }
         // Also update theme-color meta tag
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if(themeColorMeta) {
             themeColorMeta.setAttribute('content', theme === 'dark' ? '#1e1e1e' : '#4CAF50'); // Dark card or primary light
        }
    }

    // --- Goal Handling ---
    function setGoal() {
        const hours = parseFloat(goalHoursInput.value);
        if (!isNaN(hours) && hours > 0) {
            currentGoalDuration = hours * 60 * 60 * 1000; // Convert hours to milliseconds
            goalHoursInput.value = ''; // Clear input
            console.log(`Goal set to ${hours} hours (${currentGoalDuration} ms)`);
            saveState();
            updateUI(); // Update display
        } else {
            // Basic validation feedback
            alert('Please enter a valid positive number for goal hours.');
            goalHoursInput.value = '';
        }
    }

    // --- Core Functions ---

    function startFast() {
        if (currentFastStartTime) return; // Already fasting

        currentFastStartTime = Date.now();
        fastNotesInput.value = ''; // Clear notes from previous potential fast attempt
        saveState();
        updateUI();
        startTimer();
    }

    function stopFast() {
        if (!currentFastStartTime) return; // Not fasting

        const endTime = Date.now();
        const duration = endTime - currentFastStartTime;
        const notes = fastNotesInput.value.trim(); // Get notes

        const fastRecord = {
            startTime: currentFastStartTime,
            endTime: endTime,
            duration: duration,
            goalDuration: currentGoalDuration, // Store the goal active during this fast
            notes: notes || "" // Store notes, empty string if none
        };

        fastHistory.push(fastRecord);
        currentFastStartTime = null; // Reset current fast
        fastNotesInput.value = '';    // Clear notes input

        saveState();
        stopTimer();
        updateUI(); // Will re-render history & chart
    }

    function updateUI() {
        // Update Goal Display
        if (currentGoalDuration) {
            const goalHours = (currentGoalDuration / (60 * 60 * 1000)).toFixed(1);
            currentGoalDisplay.textContent = `Current Goal: ${goalHours} hours`;
        } else {
            currentGoalDisplay.textContent = 'No goal set.';
        }

        // Update Fasting Status/Controls
        if (currentFastStartTime) {
            currentStateDisplay.textContent = 'Currently Fasting';
            timerDisplay.style.display = 'block';
            startTimeDisplay.textContent = `Started: ${formatDateTime(new Date(currentFastStartTime))}`;
            startTimeDisplay.style.display = 'block';
            startBtn.disabled = true;
            stopBtn.disabled = false;
            notesInputArea.style.display = 'block'; // Show notes area when fasting

            // Show progress bar only if a goal is set
            if (currentGoalDuration && currentGoalDuration > 0) {
                progressContainer.style.display = 'block';
                updateProgressBar(); // Initial update
            } else {
                progressContainer.style.display = 'none';
            }
             goalHoursInput.disabled = true; // Disable goal input while fasting
             setGoalBtn.disabled = true;


        } else {
            currentStateDisplay.textContent = 'Not Fasting';
            timerDisplay.style.display = 'none';
            startTimeDisplay.style.display = 'none';
            progressContainer.style.display = 'none'; // Hide progress
            notesInputArea.style.display = 'none';   // Hide notes area
            resetTimerDisplay();
            startBtn.disabled = false;
            stopBtn.disabled = true;
            goalHoursInput.disabled = false; // Enable goal input when not fasting
            setGoalBtn.disabled = false;

        }
        renderHistory();
        renderOrUpdateChart(); // Update chart display
    }

    function startTimer() {
        stopTimer(); // Clear any existing timer
        updateTimerDisplay(); // Update immediately
        timerInterval = setInterval(updateTimerDisplay, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function updateTimerDisplay() {
        if (!currentFastStartTime) return;

        const elapsedMs = Date.now() - currentFastStartTime;
        const { hours, minutes, seconds } = formatDuration(elapsedMs);

        hoursDisplay.textContent = String(hours).padStart(2, '0');
        minutesDisplay.textContent = String(minutes).padStart(2, '0');
        secondsDisplay.textContent = String(seconds).padStart(2, '0');

        updateProgressBar(); // Also update progress bar every second
    }

    function resetTimerDisplay() {
        hoursDisplay.textContent = '00';
        minutesDisplay.textContent = '00';
        secondsDisplay.textContent = '00';
        // Reset progress bar as well
        progressBarInner.style.width = '0%';
        progressText.textContent = '';
    }

    function updateProgressBar() {
        if (!currentFastStartTime || !currentGoalDuration || currentGoalDuration <= 0) {
             progressContainer.style.display = 'none';
             return;
        }
        progressContainer.style.display = 'block'; // Ensure it's visible
        const elapsedMs = Date.now() - currentFastStartTime;
        let percentage = (elapsedMs / currentGoalDuration) * 100;
        percentage = Math.min(Math.max(percentage, 0), 100); // Clamp between 0 and 100

        progressBarInner.style.width = `${percentage.toFixed(1)}%`;
        progressText.textContent = `${percentage.toFixed(1)}% complete`;

    }

    // --- History Rendering ---
    function renderHistory() {
        historyList.innerHTML = ''; // Clear existing list

        if (fastHistory.length === 0) {
            noHistoryMsg.style.display = 'block';
            chartSection.style.display = 'none'; // Also hide chart section if no history
             if (historyChart) {
                historyChart.destroy();
                historyChart = null;
             }
            return;
        }

        noHistoryMsg.style.display = 'none';
        const reversedHistory = [...fastHistory].reverse(); // Newest first

        reversedHistory.forEach((fast, index) => { // Added index for potential future use
            const li = document.createElement('li');
            li.classList.add('history-item'); // Add class for styling

            const durationFormatted = formatDuration(fast.duration);
            const durationString = `${durationFormatted.hours}h ${durationFormatted.minutes}m ${durationFormatted.seconds}s`;

            const startTimeFormatted = formatDateTime(new Date(fast.startTime));
            const endTimeFormatted = formatDateTime(new Date(fast.endTime));

            let goalMetIndicator = '';
            let goalMetClass = '';
            if (fast.goalDuration) {
                if (fast.duration >= fast.goalDuration) {
                    goalMetIndicator = '<span class="goal-icon goal-met" title="Goal Met">✔</span>'; // Use symbols
                    goalMetClass = 'goal-met';
                } else {
                    goalMetIndicator = '<span class="goal-icon goal-not-met" title="Goal Not Met">✖</span>';
                    goalMetClass = 'goal-not-met';
                }
            }

            // Basic sanitization (consider a library for robust sanitization if input source is less trusted)
            const sanitizedNotes = (fast.notes || "").replace(/</g, "<").replace(/>/g, ">");

            li.innerHTML = `
                <div class="history-item-main">
                    <div class="history-item-duration ${goalMetClass}">
                         ${durationString} ${goalMetIndicator}
                     </div>
                     <div class="history-item-times">
                         ${startTimeFormatted} – ${endTimeFormatted}
                     </div>
                 </div>
                ${sanitizedNotes ? `<div class="history-item-notes">${sanitizedNotes}</div>` : ''}
            `;
            historyList.appendChild(li);
        });
         chartSection.style.display = 'block'; // Ensure chart section is visible if history exists
    }

    // --- Charting ---
     function renderOrUpdateChart() {
        // Check moved to renderHistory for efficiency
        if (fastHistory.length === 0) return;

        // Prepare data for Chart.js
        const historySlice = fastHistory.slice(-15); // Show last 15 fasts

        const labels = historySlice.map(fast => formatDateForChart(new Date(fast.startTime)));
        const durationsHours = historySlice.map(fast => (fast.duration / (1000 * 60 * 60)));
        const goalHours = historySlice.map(fast => fast.goalDuration ? (fast.goalDuration / (1000*60*60)) : null);

         // Determine colors based on theme
         const isDark = currentTheme === 'dark';
         const barBgColor = isDark ? 'rgba(102, 187, 106, 0.6)' : 'rgba(76, 175, 80, 0.7)'; // Primary variations
         const barBorderColor = isDark ? 'rgba(102, 187, 106, 1)' : 'rgba(76, 175, 80, 1)';
         const goalLineColor = isDark ? 'rgba(239, 83, 80, 0.8)' : 'rgba(244, 67, 54, 0.9)'; // Secondary variations
         const gridColor = getComputedStyle(document.body).getPropertyValue('--border-color');
         const tickColor = getComputedStyle(document.body).getPropertyValue('--text-muted-color');
         const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');


         const chartData = {
            labels: labels,
            datasets: [
                 {
                    label: 'Fast Duration (hours)',
                    data: durationsHours,
                    backgroundColor: barBgColor,
                    borderColor: barBorderColor,
                    borderWidth: 1,
                    yAxisID: 'yHours',
                    order: 2
                 },
                  {
                    label: 'Goal (hours)',
                    data: goalHours,
                    borderColor: goalLineColor,
                    borderWidth: 2.5, // Slightly thicker line
                    borderDash: [6, 3], // Adjusted dash pattern
                    type: 'line',
                    fill: false,
                    pointRadius: 0,
                    yAxisID: 'yHours',
                    order: 1,
                    tension: 0.1 // Slight curve to line
                  }
             ]
         };

         const chartOptions = {
             scales: {
                 x: {
                     ticks: { color: tickColor },
                     grid: { color: gridColor }
                 },
                 yHours: {
                     beginAtZero: true,
                     position: 'left',
                     title: { display: true, text: 'Hours', color: textColor },
                     ticks: { color: tickColor },
                     grid: { color: gridColor }
                 }
             },
             plugins: {
                legend: {
                     labels: { color: textColor }
                },
                 tooltip: {
                     backgroundColor: isDark ? 'rgba(40,40,40,0.9)' : 'rgba(255,255,255,0.9)',
                     titleColor: textColor,
                     bodyColor: textColor,
                     borderColor: gridColor,
                     borderWidth: 1,
                     padding: 10,
                     callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(1) + ' hrs';
                            }
                            return label;
                        }
                     }
                 }
             },
             maintainAspectRatio: false,
             responsive: true,
         };


        if (!historyChart) {
            const ctx = historyChartCanvas.getContext('2d');
            historyChart = new Chart(ctx, {
                type: 'bar',
                data: chartData,
                options: chartOptions
            });
        } else {
            historyChart.data = chartData;
            // Update colors and scales directly for theme changes
            updateChartAppearance(); // Call helper to apply theme colors
            historyChart.update();
        }
    }

    // Helper function to update chart colors based on theme
    function updateChartAppearance() {
         if (!historyChart) return;

         const isDark = currentTheme === 'dark';
         const gridColor = getComputedStyle(document.body).getPropertyValue('--border-color');
         const tickColor = getComputedStyle(document.body).getPropertyValue('--text-muted-color');
         const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');
         const barBgColor = isDark ? 'rgba(102, 187, 106, 0.6)' : 'rgba(76, 175, 80, 0.7)';
         const barBorderColor = isDark ? 'rgba(102, 187, 106, 1)' : 'rgba(76, 175, 80, 1)';
         const goalLineColor = isDark ? 'rgba(239, 83, 80, 0.8)' : 'rgba(244, 67, 54, 0.9)';

         historyChart.options.scales.x.ticks.color = tickColor;
         historyChart.options.scales.x.grid.color = gridColor;
         historyChart.options.scales.yHours.title.color = textColor;
         historyChart.options.scales.yHours.ticks.color = tickColor;
         historyChart.options.scales.yHours.grid.color = gridColor;
         historyChart.options.plugins.legend.labels.color = textColor;
         historyChart.options.plugins.tooltip.backgroundColor = isDark ? 'rgba(40,40,40,0.9)' : 'rgba(255,255,255,0.9)';
         historyChart.options.plugins.tooltip.titleColor = textColor;
         historyChart.options.plugins.tooltip.bodyColor = textColor;
         historyChart.options.plugins.tooltip.borderColor = gridColor;


         // Update dataset colors
         historyChart.data.datasets[0].backgroundColor = barBgColor;
         historyChart.data.datasets[0].borderColor = barBorderColor;
         historyChart.data.datasets[1].borderColor = goalLineColor;
     }


    // --- Persistence (localStorage) ---

    function saveState() {
        try {
            localStorage.setItem('fastingTrackerStateEnhanced_v1', JSON.stringify({ // Added version suffix
                currentFastStartTime: currentFastStartTime,
                fastHistory: fastHistory,
                currentGoalDuration: currentGoalDuration,
                currentTheme: currentTheme
            }));
             console.log("State saved.");
        } catch (error) {
            console.error("Error saving state to localStorage:", error);
            // Consider adding user feedback here if critical
        }
    }

    function loadState() {
        try {
            const savedState = localStorage.getItem('fastingTrackerStateEnhanced_v1'); // Use version suffix
            if (savedState) {
                 console.log("Loading saved state...");
                const state = JSON.parse(savedState);

                currentTheme = state.currentTheme || 'light';
                // Apply theme *before* other UI updates that might depend on it
                applyTheme(currentTheme);

                currentFastStartTime = state.currentFastStartTime || null;
                fastHistory = state.fastHistory || [];
                 // Basic validation/migration if needed for history structure changes
                 fastHistory = fastHistory.filter(item => item && typeof item.startTime === 'number' && typeof item.duration === 'number');

                currentGoalDuration = state.currentGoalDuration || null;

                if (currentFastStartTime) {
                     console.log("Resuming active fast timer.");
                    startTimer();
                }
                console.log("State loaded successfully.");
            } else {
                 console.log("No saved state found, using defaults.");
                 applyTheme(currentTheme); // Apply default theme
            }
        } catch (error) {
            console.error("Error loading state from localStorage:", error);
            localStorage.removeItem('fastingTrackerStateEnhanced_v1'); // Clear potentially corrupted state
            // Reset to defaults
            currentFastStartTime = null;
            fastHistory = [];
            currentGoalDuration = null;
            currentTheme = 'light';
            applyTheme(currentTheme);
            // alert("Could not load previous data. Starting fresh."); // User feedback
        }
    }

    // --- Utility Functions ---

    function formatDuration(ms) {
        if (ms < 0) ms = 0;
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return { hours, minutes, seconds };
    }

    function formatDateTime(date) {
        // e.g., "Oct 26, 10:30 AM"
         if (!(date instanceof Date) || isNaN(date)) {
            return "Invalid Date"; // Handle invalid date input
        }
        const options = {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        };
        try {
            return date.toLocaleString(undefined, options);
        } catch (e) {
            console.error("Error formatting date:", e);
            // Fallback to a more basic format if locale fails
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        }
    }
     function formatDateForChart(date) {
         if (!(date instanceof Date) || isNaN(date)) {
            return "?"; // Handle invalid date input
        }
        // e.g., "10/26"
         const options = { month: 'numeric', day: 'numeric' };
          try {
            return date.toLocaleDateString(undefined, options);
        } catch (e) {
             console.error("Error formatting date for chart:", e);
             return date.toISOString().substring(5, 10); // Fallback M-D
        }
     }

}); // End DOMContentLoaded
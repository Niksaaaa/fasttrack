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
    // New elements
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

    // --- State variables ---
    let currentFastStartTime = null; // Timestamp (ms) when current fast started, or null
    let fastHistory = [];            // Array of completed fast objects
    let timerInterval = null;        // Holds the interval ID for the timer
    let currentGoalDuration = null;  // Target duration in milliseconds, or null
    let currentTheme = 'light';      // 'light' or 'dark'
    let historyChart = null;         // Chart.js instance

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


    // --- PWA ---
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
            // Basic validation feedback (could be more user-friendly)
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
             // Don't show progress if no start time or no valid goal
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
            return;
        }

        noHistoryMsg.style.display = 'none';
        const reversedHistory = [...fastHistory].reverse(); // Newest first

        reversedHistory.forEach(fast => {
            const li = document.createElement('li');

            const durationFormatted = formatDuration(fast.duration);
            const durationString = `${durationFormatted.hours}h ${durationFormatted.minutes}m ${durationFormatted.seconds}s`;

            const startTimeFormatted = formatDateTime(new Date(fast.startTime));
            const endTimeFormatted = formatDateTime(new Date(fast.endTime));

            let goalMetIndicator = '';
            if (fast.goalDuration && fast.duration >= fast.goalDuration) {
                goalMetIndicator = ' <span style="color: var(--primary-color); font-size: 1.1em;" title="Goal Met">✓</span>'; // Simple checkmark
            } else if (fast.goalDuration) {
                goalMetIndicator = ' <span style="color: var(--secondary-color); font-size: 0.9em;" title="Goal Not Met">✕</span>';
            }

            // Sanitize notes to prevent basic HTML injection if displaying directly
            // A more robust sanitizer would be needed for untrusted input
            const sanitizedNotes = fast.notes.replace(/</g, "<").replace(/>/g, ">");


            li.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-duration">${durationString}${goalMetIndicator}</span>
                    <span class="history-item-times">
                        ${startTimeFormatted} – ${endTimeFormatted}
                    </span>
                </div>
                ${fast.notes ? `<div class="history-item-notes">${sanitizedNotes}</div>` : ''}
            `;
            historyList.appendChild(li);
        });
    }

    // --- Charting ---
     function renderOrUpdateChart() {
        if (fastHistory.length === 0) {
            chartSection.style.display = 'none';
             if (historyChart) {
                historyChart.destroy(); // Clean up existing chart instance
                historyChart = null;
            }
            return;
        }

        chartSection.style.display = 'block';

        // Prepare data for Chart.js
        // Show last N fasts, e.g., last 15
        const historySlice = fastHistory.slice(-15);

        const labels = historySlice.map(fast => formatDateForChart(new Date(fast.startTime)));
        const durationsHours = historySlice.map(fast => (fast.duration / (1000 * 60 * 60))); // Duration in hours
        const goalHours = historySlice.map(fast => fast.goalDuration ? (fast.goalDuration / (1000*60*60)) : null); // Goal in hours or null/undefined

         const chartData = {
            labels: labels,
            datasets: [
                 {
                    label: 'Fast Duration (hours)',
                    data: durationsHours,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)', // Teal base color
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    yAxisID: 'yHours', // Assign to the primary Y axis
                    order: 2 // Render bars behind line
                 },
                  {
                    label: 'Goal (hours)',
                    data: goalHours,
                    borderColor: 'rgba(255, 99, 132, 0.8)', // Reddish color for goal line
                    borderWidth: 2,
                    borderDash: [5, 5], // Dashed line for goal
                    type: 'line', // Render as a line chart on top
                    fill: false, // Don't fill under the line
                    pointRadius: 0, // No points on the goal line
                    yAxisID: 'yHours', // Use the same axis
                    order: 1 // Render line on top of bars
                  }
             ]
         };

         const chartOptions = {
             scales: {
                 x: {
                     ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted-color') }, // Dynamic color
                     grid: { color: getComputedStyle(document.body).getPropertyValue('--border-color') }      // Dynamic color
                 },
                 yHours: { // Define the Y axis for hours
                     beginAtZero: true,
                     position: 'left',
                     title: { display: true, text: 'Hours', color: getComputedStyle(document.body).getPropertyValue('--text-color') }, // Dynamic color
                     ticks: { color: getComputedStyle(document.body).getPropertyValue('--text-muted-color') },// Dynamic color
                     grid: { color: getComputedStyle(document.body).getPropertyValue('--border-color') }     // Dynamic color
                 }
             },
             plugins: {
                legend: {
                     labels: { color: getComputedStyle(document.body).getPropertyValue('--text-color') } // Dynamic color
                },
                 tooltip: {
                     callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed.y !== null) {
                                // Show hours with one decimal place
                                label += context.parsed.y.toFixed(1) + ' hrs';
                            }
                            return label;
                        }
                     }
                 }
             },
             maintainAspectRatio: false, // Allow chart to fill container height
             responsive: true,
         };


        if (!historyChart) {
            // Create new chart
            const ctx = historyChartCanvas.getContext('2d');
            historyChart = new Chart(ctx, {
                type: 'bar', // Base type is bar
                data: chartData,
                options: chartOptions
            });
        } else {
            // Update existing chart
            historyChart.data = chartData;
             // Re-apply dynamic colors in case theme changed
             updateChartAppearance();
            historyChart.update();
        }
    }

    // Helper function to update chart colors based on theme
    function updateChartAppearance() {
         if (!historyChart) return;
          const textColor = getComputedStyle(document.body).getPropertyValue('--text-color');
          const mutedColor = getComputedStyle(document.body).getPropertyValue('--text-muted-color');
          const borderColor = getComputedStyle(document.body).getPropertyValue('--border-color');
          const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary-color');
          const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-color'); // Use accent or primary/secondary as base

           // Bar colors (use semi-transparent accent)
         const barBgColor = currentTheme === 'dark' ? 'rgba(90, 200, 250, 0.6)' : 'rgba(33, 150, 243, 0.6)'; // Example accent colors
         const barBorderColor = currentTheme === 'dark' ? 'rgba(90, 200, 250, 1)' : 'rgba(33, 150, 243, 1)';
         // Goal line color (use semi-transparent secondary/reddish)
         const goalLineColor = currentTheme === 'dark' ? 'rgba(239, 83, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)'; // Example secondary colors


         historyChart.options.scales.x.ticks.color = mutedColor;
         historyChart.options.scales.x.grid.color = borderColor;
         historyChart.options.scales.yHours.title.color = textColor;
         historyChart.options.scales.yHours.ticks.color = mutedColor;
         historyChart.options.scales.yHours.grid.color = borderColor;
         historyChart.options.plugins.legend.labels.color = textColor;

         // Update dataset colors
          historyChart.data.datasets[0].backgroundColor = barBgColor; // Bar fill
          historyChart.data.datasets[0].borderColor = barBorderColor; // Bar border
          historyChart.data.datasets[1].borderColor = goalLineColor; // Goal line

         // Tooltip styles might need adjustment if using custom HTML tooltips, but defaults usually adapt well
     }


    // --- Persistence (localStorage) ---

    function saveState() {
        try {
            localStorage.setItem('fastingTrackerStateEnhanced', JSON.stringify({
                currentFastStartTime: currentFastStartTime,
                fastHistory: fastHistory,
                currentGoalDuration: currentGoalDuration,
                currentTheme: currentTheme
            }));
             console.log("State saved.");
        } catch (error) {
            console.error("Error saving state to localStorage:", error);
            // alert("Could not save your data. LocalStorage might be full or disabled.");
        }
    }

    function loadState() {
        try {
            const savedState = localStorage.getItem('fastingTrackerStateEnhanced');
            if (savedState) {
                 console.log("Loading saved state...");
                const state = JSON.parse(savedState);
                // Load Theme FIRST so UI elements have correct initial style for calculations/chart
                currentTheme = state.currentTheme || 'light';
                applyTheme(currentTheme); // Apply theme immediately

                currentFastStartTime = state.currentFastStartTime || null;
                fastHistory = state.fastHistory || [];
                currentGoalDuration = state.currentGoalDuration || null;


                // If the page was closed while fasting, restart the timer
                if (currentFastStartTime) {
                     console.log("Resuming active fast timer.");
                    startTimer();
                }
                console.log("State loaded successfully.");
            } else {
                 console.log("No saved state found, using defaults.");
                 // Apply default theme if no state saved
                 applyTheme(currentTheme); // Should be 'light' by default
            }
        } catch (error) {
            console.error("Error loading state from localStorage:", error);
            // Reset state on error to prevent partial loading issues
            currentFastStartTime = null;
            fastHistory = [];
            currentGoalDuration = null;
            currentTheme = 'light'; // Reset theme to default
            applyTheme(currentTheme); // Apply default theme
            // alert("Could not load previous data. Starting fresh.");
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
        const options = {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        };
        try {
            return date.toLocaleString(undefined, options); // Use browser's locale
        } catch (e) {
            console.error("Error formatting date:", e);
            return date.toISOString(); // Fallback
        }
    }
     function formatDateForChart(date) {
        // e.g., "10/26" (Month/Day) - Keep labels concise
         const options = { month: 'numeric', day: 'numeric' };
          try {
            return date.toLocaleDateString(undefined, options); // Use browser's locale
        } catch (e) {
             console.error("Error formatting date for chart:", e);
             return date.toISOString().substring(5, 10); // Fallback M-D
        }

     }

}); // End DOMContentLoaded
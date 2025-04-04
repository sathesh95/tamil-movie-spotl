// public/script.js
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('movie-search');
    const suggestionsBox = document.getElementById('suggestions-box');
    const guessButton = document.getElementById('guess-button');
    const chancesLeftSpan = document.getElementById('chances-left');
    const guessesHistoryDiv = document.getElementById('guesses-history');
    const messageArea = document.getElementById('message-area');
    const timerDisplay = document.getElementById('timer-display');

    const MAX_CHANCES = 5;
    let chancesLeft = MAX_CHANCES;
    let selectedMovie = null; // { id: ..., title: ... }
    let gameOver = false;
    let startTime = Date.now();
    let timerInterval;

    // --- Timer ---
    function startTimer() {
        startTime = Date.now(); // Reset start time on game start/reset
        timerInterval = setInterval(() => {
            if (!gameOver) {
                const seconds = Math.floor((Date.now() - startTime) / 1000);
                timerDisplay.textContent = `${seconds}`;
            }
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    // --- Autocomplete ---
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = searchInput.value.trim();

        suggestionsBox.innerHTML = ''; // Clear previous suggestions
        suggestionsBox.style.display = 'none';
        guessButton.disabled = true;
        selectedMovie = null;

        if (query.length < 2) { // Don't search for very short strings
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchSuggestions(query);
        }, 300); // Debounce API calls
    });

    async function fetchSuggestions(query) {
        // Use '/api/search_movies' which routes to our Vercel function
        const apiUrl = `/api/search_movies?q=${encodeURIComponent(query)}`;
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const suggestions = await response.json();
            displaySuggestions(suggestions);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            messageArea.textContent = 'Error fetching movie suggestions.';
            messageArea.className = 'error-message';
        }
    }

    function displaySuggestions(suggestions) {
        suggestionsBox.innerHTML = ''; // Clear again just in case
        if (suggestions.length === 0) {
            suggestionsBox.style.display = 'none';
            return;
        }

        suggestions.forEach(movie => {
            const div = document.createElement('div');
            div.classList.add('suggestion-item');
            div.textContent = `${movie.title} (${movie.year})`;
            div.dataset.movieId = movie.id;
            div.dataset.movieTitle = movie.title; // Store title too
            div.addEventListener('click', () => {
                selectSuggestion(movie);
            });
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    }

    function selectSuggestion(movie) {
        searchInput.value = `${movie.title} (${movie.year})`; // Display selected movie
        selectedMovie = { id: movie.id, title: movie.title };
        suggestionsBox.innerHTML = '';
        suggestionsBox.style.display = 'none';
        guessButton.disabled = false; // Enable guess button
    }

    // Hide suggestions when clicking outside
    document.addEventListener('click', (event) => {
        if (!searchInput.contains(event.target) && !suggestionsBox.contains(event.target)) {
            suggestionsBox.style.display = 'none';
        }
    });

    // --- Guessing Logic ---
    guessButton.addEventListener('click', handleGuess);

    async function handleGuess() {
        if (gameOver || !selectedMovie) return;

        guessButton.disabled = true; // Disable during processing
        messageArea.textContent = ''; // Clear previous messages

        try {
            // Use '/api/check_guess' which routes to our Vercel function
            const response = await fetch('/api/check_guess', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ guessedMovieId: selectedMovie.id }),
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            processGuessResult(result);

        } catch (error) {
            console.error('Error checking guess:', error);
            messageArea.textContent = `Error: ${error.message}`;
             messageArea.className = 'error-message';
             guessButton.disabled = !gameOver ? false : true; // Re-enable if game not over
        } finally {
             // Clear input and selection after guess attempt
            searchInput.value = '';
            selectedMovie = null;
            // Keep button disabled until a new valid selection is made, unless game is over
            if (!gameOver) {
                 guessButton.disabled = true;
            }
        }
    }

    function processGuessResult(result) {
        chancesLeft--;
        chancesLeftSpan.textContent = chancesLeft;

        addGuessToHistory(result.guessedMovie, result.matches);

        if (result.correctGuess) {
            gameOver = true;
            stopTimer();
            const timeTaken = Math.floor((Date.now() - startTime) / 1000);
             // Correction: Use movie title, not cricketer
            messageArea.textContent = `🎉 You've guessed the right movie in ${timeTaken} seconds! It was ${result.guessedMovie.title}.`;
            messageArea.className = 'success-message';
            guessButton.disabled = true;
            searchInput.disabled = true;
        } else if (chancesLeft <= 0) {
            gameOver = true;
            stopTimer();
            messageArea.textContent = '😥 Out of chances! Better luck tomorrow.';
             messageArea.className = 'error-message';
            guessButton.disabled = true;
             searchInput.disabled = true;
             // Optionally reveal the movie here by making another API call or if the backend sent it
        } else {
             // Keep playing - re-enable button ONLY if a valid suggestion is picked
             guessButton.disabled = true; // Stays disabled until next selection
        }
    }

    function addGuessToHistory(guessedMovie, matches) {
        const row = document.createElement('div');
        row.classList.add('guess-row');

        // Helper function to create a cell
        const createCell = (content, isMatch) => {
            const cell = document.createElement('div');
            cell.textContent = Array.isArray(content) ? content.join(', ') : content; // Handle genre array
             if (isMatch) {
                cell.classList.add('match');
            }
            return cell;
        };

        row.appendChild(createCell(guessedMovie.title, matches.correctGuess)); // Whole row isn't green, just cells
        row.appendChild(createCell(guessedMovie.release_year, matches.release_year));
        row.appendChild(createCell(guessedMovie.genres, matches.genre));
        row.appendChild(createCell(guessedMovie.starting_letter, matches.starting_letter));
        row.appendChild(createCell(guessedMovie.director, matches.director));
        row.appendChild(createCell(guessedMovie.lead_actor, matches.lead_actor));

        // Prepend the new guess to the top of the history
        guessesHistoryDiv.prepend(row);
    }

    // --- Initialization ---
    function initializeGame() {
         chancesLeft = MAX_CHANCES;
         chancesLeftSpan.textContent = chancesLeft;
         gameOver = false;
         guessesHistoryDiv.innerHTML = '';
         messageArea.textContent = '';
         messageArea.className = '';
         searchInput.value = '';
         searchInput.disabled = false;
         suggestionsBox.innerHTML = '';
         suggestionsBox.style.display = 'none';
         guessButton.disabled = true;
         selectedMovie = null;
         timerDisplay.textContent = '0';
         stopTimer(); // Clear any existing timer
         startTimer(); // Start new timer
    }

    // Initial game setup
    initializeGame();
});
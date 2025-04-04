// api/check_guess.js
const fetch = require('node-fetch');
// Import helper functions from get_daily_movie.js
const { getDailyMovieId, getMovieDetails } = require('./get_daily_movie');

const TMDB_API_KEY = process.env.TMDB_API_KEY; // Ensure this is consistent

module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Allow POST for sending guess
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

     if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!TMDB_API_KEY) {
        return res.status(500).json({ error: 'TMDB API Key not configured.' });
    }

    let guessedMovieId;
    try {
        // Vercel automatically parses JSON body for POST requests if Content-Type is application/json
         if (typeof req.body === 'string') { // Handle cases where body might be stringified
            guessedMovieId = JSON.parse(req.body).guessedMovieId;
        } else {
            guessedMovieId = req.body.guessedMovieId;
        }

        if (!guessedMovieId) {
            return res.status(400).json({ error: 'Missing guessedMovieId in request body.' });
        }
    } catch(e) {
         return res.status(400).json({ error: 'Invalid JSON body.' });
    }


    try {
        const mysteryMovieId = getDailyMovieId();

        // Fetch details for both movies in parallel
        const [mysteryMovieDetails, guessedMovieDetails] = await Promise.all([
            getMovieDetails(mysteryMovieId),
            getMovieDetails(guessedMovieId)
        ]);

        if (!mysteryMovieDetails || !guessedMovieDetails) {
            return res.status(504).json({ error: 'Failed to fetch movie details from TMDB.' });
        }

        // --- Comparison Logic ---
        const correctGuess = mysteryMovieDetails.id === guessedMovieDetails.id;

        // Genre Check: Check if *any* genre from the guess matches *any* genre from the mystery movie
        const genreMatch = guessedMovieDetails.genres.some(g => mysteryMovieDetails.genres.includes(g));

        const result = {
            correctGuess: correctGuess,
            guessedMovie: { // Send back details of the guessed movie for display
                title: guessedMovieDetails.title,
                release_year: guessedMovieDetails.release_year,
                genres: guessedMovieDetails.genres,
                director: guessedMovieDetails.director,
                lead_actor: guessedMovieDetails.lead_actor,
                starting_letter: guessedMovieDetails.starting_letter
            },
            matches: {
                release_year: mysteryMovieDetails.release_year === guessedMovieDetails.release_year,
                genre: genreMatch, // Use the partial match logic
                starting_letter: mysteryMovieDetails.starting_letter === guessedMovieDetails.starting_letter,
                director: mysteryMovieDetails.director !== 'N/A' && mysteryMovieDetails.director === guessedMovieDetails.director,
                lead_actor: mysteryMovieDetails.lead_actor !== 'N/A' && mysteryMovieDetails.lead_actor === guessedMovieDetails.lead_actor
            }
        };

        res.status(200).json(result);

    } catch (error) {
        console.error('Error in check_guess handler:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
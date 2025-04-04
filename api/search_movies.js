// api/search_movies.js
const fetch = require('node-fetch');
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!TMDB_API_KEY) {
        return res.status(500).json({ error: 'TMDB API Key not configured.' });
    }

    const query = req.query.q; // Get search query from query parameter ?q=...

    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required.' });
    }

    // TMDB Search URL - Crucially add language=ta and region=IN
    const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=ta&include_adult=false&region=IN`;

    try {
        const response = await fetch(searchUrl);
        if (!response.ok) {
            console.error(`TMDB Search Error: ${response.statusText}`);
            return res.status(response.status).json({ error: 'Failed to fetch from TMDB.' });
        }

        const data = await response.json();

        // Map results to a simpler format for autocomplete
        const suggestions = data.results.map(movie => ({
            id: movie.id,
            title: movie.title,
            year: movie.release_date ? movie.release_date.substring(0, 4) : 'N/A'
        })).slice(0, 10); // Limit to 10 suggestions

        res.status(200).json(suggestions);

    } catch (error) {
        console.error('Error in search_movies handler:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
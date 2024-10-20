require('dotenv').config()
const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Twitter API keys (replace with your own keys)
const client = new TwitterApi({
	appKey: process.env.API_KEY,
	appSecret: process.env.API_KEY_SECRET,
	accessToken: process.env.ACCESS_TOKEN,
	accessSecret: process.env.ACCESS_TOKEN_SECRET
});

// Fetch historical events from Wikipedia
async function getHistoricalEvents() {
	const today = new Date();
	const month = today.getMonth() + 1; // months are zero-indexed in JS, so we add 1
	const day = today.getDate();
	const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`;
  
	try {
		const response = await axios.get(url);
		const events = response.data.events; // Get the events for the day
		
		return events;
	} catch (error) {
		console.error("Error fetching events:", error);
		return [];
	}
}

// Select a different event each year from the list of events
async function selectEventRoundRobin() {
	const eventsList = await getHistoricalEvents();
  
	if (eventsList?.length === 0) {
		console.log("No events found.");
		return "Nothing happened today. Even history needs a break sometimes!";
	}
  
	// Get the current date
	const today = new Date();
  
	// Get the current year
	const currentYear = today.getFullYear();
  
	// Get the day of the year (1 - 365/366)
	const startOfYear = new Date(today.getFullYear(), 0, 0);
	const diffInTime = today - startOfYear;
	const oneDay = 1000 * 60 * 60 * 24;
	const dayOfYear = Math.floor(diffInTime / oneDay);
  
	// Combine year and dayOfYear for round-robin selection across years
	const index = (currentYear + dayOfYear) % eventsList?.length;  // Shift based on both year and dayOfYear
  
	const selectedEvent = eventsList[index];
	const updatedTweet = updateTweet(selectedEvent);
  
	return `On this day in ${selectedEvent.year}: ${updatedTweet}`;
}

// Replace words in the tweet text with hashtags
function replaceWordsWithHashtags(text, pages) {
    let updatedText = text;

    pages.forEach(page => {
        if (page.title) {
            const formattedTitle = page.title.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
            const hashtag = `#${formattedTitle}`;
            
            // Replace occurrences of the normalized title in the tweet text with the hashtag
            const regex = new RegExp(`\\b${page.normalizedtitle.replace(/_/g, ' ')}\\b`, 'gi');
            updatedText = updatedText.replace(regex, hashtag);
        }
    });

    return updatedText;
}

// Main function to update the tweet
function updateTweet(payload) {
    const updatedTweet = replaceWordsWithHashtags(payload.text, payload.pages);
    return updatedTweet;
}

// Function to post a tweet
async function postTweet() {
	try {
		const tweetText = await selectEventRoundRobin();
		console.log(tweetText)
	  	const response = await client.v2.tweet(tweetText);
	  	console.log('Tweet posted successfully:', response);
	} catch (error) {
	  	console.error('Error posting tweet:', error);
	}
}

// A simple route to check if the server is running
app.get('/post', (req, res) => {
    res.send('Twitter bot is running!');
	console.log(`Posting tweet for the day ${new Date()}`);
	postTweet();
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
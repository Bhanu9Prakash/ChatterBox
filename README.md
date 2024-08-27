# ChatterBox

ChatterBox is a web-based chat application that allows users to have conversations with an AI assistant. It features a clean, responsive interface with support for multiple conversations and a dark mode.

## Features

- Real-time chat with an AI assistant
- Multiple conversation support
- Conversation management (rename, delete)
- Dark mode toggle
- Responsive design for desktop and mobile devices
- Markdown support in chat messages

## Technologies Used

- Frontend: HTML, CSS, JavaScript
- Backend: Go
- AI Integration: Perplexity API

## Project Structure

The project is structured as follows:

- `cmd/server/`: Contains the main Go server file
- `internal/`: 
  - `api/`: Handles communication with the Perplexity API
  - `handlers/`: Contains HTTP request handlers
- `static/`:
  - `css/`: Contains the styles for the application
  - `js/`: Contains the client-side JavaScript
- `templates/`: Contains the HTML template for the main page

## Setup and Installation

1. Clone the repository
2. Set up your Perplexity API token in the `.env` file:

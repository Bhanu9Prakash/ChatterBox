package handlers

import (
	"encoding/json"
	"fmt"
	"learn/internal/api"
	"net/http"
	"strings"
	"sync"
)

const (
	maxResponseTokens = 1000  // Maximum tokens for model response
	summaryThreshold  = 90000 // Threshold to trigger summarization (70% of max tokens)
)

type Conversation struct {
	ID       string        `json:"id"`
	Title    string        `json:"title"`
	Messages []api.Message `json:"messages"`
	Summary  string        `json:"summary"`
}

var (
	conversations = make(map[string]*Conversation)
	mu            sync.Mutex
)

func ChatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	conversationID := r.URL.Query().Get("conversationId")
	userMessage := r.URL.Query().Get("message")

	if conversationID == "" || userMessage == "" {
		http.Error(w, "Missing conversationId or message", http.StatusBadRequest)
		return
	}

	mu.Lock()
	conversation, exists := conversations[conversationID]
	if !exists {
		conversation = &Conversation{
			ID:       conversationID,
			Messages: []api.Message{},
		}
		conversations[conversationID] = conversation
	}
	mu.Unlock()

	userMsg := api.Message{Role: "user", Content: userMessage}
	conversation.Messages = append(conversation.Messages, userMsg)

	apiMessages := prepareMessages(conversation)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	responseChan := make(chan string)
	doneChan := make(chan bool)

	go api.GetPerplexityResponse(apiMessages, maxResponseTokens, responseChan, doneChan)

	var fullResponse strings.Builder
	for {
		select {
		case chunk := <-responseChan:
			encodedChunk, _ := json.Marshal(chunk)
			fmt.Fprintf(w, "data: %s\n\n", string(encodedChunk))
			flusher.Flush()
		case <-doneChan:
			formattedFullResponse := fullResponse.String()
			responseMessage := api.Message{
				Role:    "assistant",
				Content: formattedFullResponse,
			}

			mu.Lock()
			conversation.Messages = append(conversation.Messages, responseMessage)

			var generatedTitle string
			if len(conversation.Messages) == 2 {
				generatedTitle = generateTitle(conversation.Messages[0].Content)
				conversation.Title = generatedTitle
			}
			mu.Unlock()

			manageTokenLimit(conversation)

			if generatedTitle != "" {
				titleEvent := fmt.Sprintf("data: {\"event\": \"title\", \"title\": %q}\n\n", generatedTitle)

				fmt.Fprint(w, titleEvent)
			}

			fmt.Fprintf(w, "data: [DONE]\n\n")
			flusher.Flush()
			return
		}
	}
}
func prepareMessages(conv *Conversation) []api.Message {
	var messages []api.Message

	// Add system message with summary if available
	if conv.Summary != "" {
		messages = append(messages, api.Message{
			Role:    "system",
			Content: fmt.Sprintf("Previous conversation summary: %s", conv.Summary),
		})
	}

	// Add all messages, thanks to the large context window
	messages = append(messages, conv.Messages...)

	return messages
}

func manageTokenLimit(conv *Conversation) {
	totalTokens := estimateTokens(conv)

	if totalTokens > summaryThreshold {
		// Summarize the conversation
		summary := summarizeConversation(conv)
		conv.Summary = summary

		// Keep only the most recent messages
		if len(conv.Messages) > 50 {
			conv.Messages = conv.Messages[len(conv.Messages)-50:]
		}
	}
}

func summarizeConversation(conv *Conversation) string {
	summarizationPrompt := api.Message{
		Role:    "system",
		Content: "Summarize the following conversation, highlighting key points and important information:",
	}

	var contextMessages []api.Message
	contextMessages = append(contextMessages, summarizationPrompt)
	contextMessages = append(contextMessages, conv.Messages[:len(conv.Messages)-10]...)

	summaryChan := make(chan string)
	doneChan := make(chan bool)

	go api.GetPerplexityResponse(contextMessages, 2000, summaryChan, doneChan)

	var summary strings.Builder
	for {
		select {
		case chunk := <-summaryChan:
			summary.WriteString(chunk)
		case <-doneChan:
			return summary.String()
		}
	}
}

func estimateTokens(conv *Conversation) int {
	// Simple estimation: assume 1 token per 4 characters
	totalChars := 0
	for _, msg := range conv.Messages {
		totalChars += len(msg.Content)
	}
	return totalChars / 4
}

func generateTitle(firstMessage string) string {
	titlePrompt := api.Message{
		Role:    "user",
		Content: fmt.Sprintf("Generate a brief, catchy title (5 words or less) for a conversation starting with this message: '%s'", firstMessage),
	}

	titleChan := make(chan string)
	doneChan := make(chan bool)

	go api.GetPerplexityResponse([]api.Message{titlePrompt}, 20, titleChan, doneChan)

	var title strings.Builder
	for {
		select {
		case chunk := <-titleChan:
			title.WriteString(chunk)
		case <-doneChan:
			return strings.TrimSpace(title.String())
		}
	}
}

func GetConversationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	conversationID := r.URL.Query().Get("id")
	if conversationID == "" {
		http.Error(w, "Conversation ID is required", http.StatusBadRequest)
		return
	}

	mu.Lock()
	conversation, exists := conversations[conversationID]
	mu.Unlock()

	if !exists {
		http.Error(w, "Conversation not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(conversation)
}

func DeleteConversationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	conversationID := r.URL.Query().Get("id")
	if conversationID == "" {
		http.Error(w, "Conversation ID is required", http.StatusBadRequest)
		return
	}

	mu.Lock()
	delete(conversations, conversationID)
	mu.Unlock()

	w.WriteHeader(http.StatusOK)
}

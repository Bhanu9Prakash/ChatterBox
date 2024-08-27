package api

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

const (
	MaxModelTokens = 128000
)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	Model            string    `json:"model"`
	Messages         []Message `json:"messages"`
	MaxTokens        int       `json:"max_tokens,omitempty"`
	Temperature      float64   `json:"temperature,omitempty"`
	TopP             float64   `json:"top_p,omitempty"`
	TopK             int       `json:"top_k,omitempty"`
	Stream           bool      `json:"stream"`
	PresencePenalty  float64   `json:"presence_penalty,omitempty"`
	FrequencyPenalty float64   `json:"frequency_penalty,omitempty"`
}

type ChatResponse struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
}

func getAPIToken() (string, error) {
	token := os.Getenv("PERPLEXITY_API_TOKEN")
	if token == "" {
		return "", fmt.Errorf("PERPLEXITY_API_TOKEN environment variable is not set")
	}
	return token, nil
}

func GetPerplexityResponse(messages []Message, maxTokens int, responseChan chan<- string, doneChan chan<- bool) {
	url := "https://api.perplexity.ai/chat/completions"
	chatRequest := ChatRequest{
		Model:       "llama-3.1-sonar-small-128k-online",
		Messages:    messages,
		MaxTokens:   maxTokens,
		Temperature: 0.7,
		TopP:        0.9,
		Stream:      true,
	}

	payload, err := json.Marshal(chatRequest)
	if err != nil {
		responseChan <- fmt.Sprintf("Error: %v", err)
		doneChan <- true
		return
	}

	req, err := http.NewRequest("POST", url, strings.NewReader(string(payload)))
	if err != nil {
		responseChan <- fmt.Sprintf("Error: %v", err)
		doneChan <- true
		return
	}

	req.Header.Add("accept", "application/json")
	req.Header.Add("content-type", "application/json")

	token, err := getAPIToken()
	if err != nil {
		responseChan <- fmt.Sprintf("Error: %v", err)
		doneChan <- true
		return
	}

	req.Header.Add("authorization", "Bearer "+token)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		responseChan <- fmt.Sprintf("Error: %v", err)
		doneChan <- true
		return
	}
	defer resp.Body.Close()

	reader := bufio.NewReader(resp.Body)
	for {
		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				break
			}
			responseChan <- fmt.Sprintf("Error reading stream: %v", err)
			break
		}

		line = bytes.TrimSpace(line)
		if !bytes.HasPrefix(line, []byte("data: ")) {
			continue
		}
		line = bytes.TrimPrefix(line, []byte("data: "))

		if string(line) == "[DONE]" {
			break
		}

		var chatResp ChatResponse
		err = json.Unmarshal(line, &chatResp)
		if err != nil {
			responseChan <- fmt.Sprintf("Error parsing JSON: %v", err)
			continue
		}

		if len(chatResp.Choices) > 0 {
			content := chatResp.Choices[0].Delta.Content
			if content != "" {
				responseChan <- content
			}
			if chatResp.Choices[0].FinishReason != "" {
				break
			}
		}
	}

	doneChan <- true
}

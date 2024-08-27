let conversationList;
let currentConversationId = null;

document.addEventListener('DOMContentLoaded', function() {
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    const newChatButton = document.getElementById('new-chat-button');
    conversationList = document.getElementById('conversation-list');
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    
    function toggleMenu(e) {
        const menuIcon = e.target.closest('.menu-icon');
        if (menuIcon) {
            const menuOptions = menuIcon.nextElementSibling;
            // Toggle this menu and close others
            document.querySelectorAll('.menu-options').forEach(menu => {
                if (menu === menuOptions) {
                    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                } else {
                    menu.style.display = 'none';
                }
            });
            e.stopPropagation(); // Stop event from bubbling to the body
        }
    }

    function closeMenus(e) {
        // Close all menus if the click is not on a menu or menu icon
        if (!e.target.closest('.menu-icon, .menu-options')) {
            document.querySelectorAll('.menu-options').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    }

    // Attach event listeners
    body.addEventListener('click', closeMenus); // Handle clicks outside menus
    document.querySelectorAll('.menu-icon').forEach(icon => {
        icon.addEventListener('click', toggleMenu); // Handle clicks on menu icons
    });
    


    function generateConversationId() {
        return 'conv_' + Date.now();
    }

    function clearMessages() {
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
    }

    function startNewConversation() {
        currentConversationId = generateConversationId();
        localStorage.setItem(currentConversationId, JSON.stringify({title: '', messages: []}));
        localStorage.setItem('lastConversationId', currentConversationId);
        clearMessages();
        
        // Remove active class from all conversations
        document.querySelectorAll('.conversation-item').forEach(item => item.classList.remove('active'));
        
        updateConversationList(conversationList);
    }

    function saveMessage(message, type, title = '') {
        if (!currentConversationId) {
            startNewConversation();
        }
        let conversationData = JSON.parse(localStorage.getItem(currentConversationId) || '{"title":"","messages":[]}');
        if (!conversationData.messages) {
            conversationData.messages = [];
        }
        if (message || type === 'system') {
            conversationData.messages.push({ type, content: message, timestamp: Date.now() });
        }
        if (title) {
            console.log('Saving new title:', title); // Add this log
            conversationData.title = title;
        }
        localStorage.setItem(currentConversationId, JSON.stringify(conversationData));
        updateConversationList(conversationList);
    }

    function loadConversation(conversationId) {
        currentConversationId = conversationId;
        
        // First, try to load from local storage
        const localData = localStorage.getItem(conversationId);
        if (localData) {
            try {
                const conversationData = JSON.parse(localData);
                
                clearMessages();
                if (Array.isArray(conversationData.messages)) {
                    conversationData.messages.forEach(msg => appendMessage(msg.content, msg.type));
                }
                localStorage.setItem('lastConversationId', currentConversationId);
                
                // Update active state in the conversation list
                document.querySelectorAll('.conversation-item').forEach(item => {
                    item.classList.toggle('active', item.dataset.conversationId === conversationId);
                });
                
                updateConversationList(conversationList);
                return; // Exit the function if we successfully loaded from local storage
            } catch (error) {
                console.error('Error parsing local storage data:', error);
            }
        }
        
        // If not in local storage or parsing failed, fetch from the server
        fetch(`/conversation?id=${conversationId}`)
            .then(response => {
                if (response.status === 404) {
                    throw new Error('Conversation not found');
                }
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(conversationData => {
                console.log('Parsed conversation data from server:', conversationData);
                
                clearMessages();
                if (Array.isArray(conversationData.messages)) {
                    conversationData.messages.forEach(msg => appendMessage(msg.content, msg.type));
                }
                localStorage.setItem('lastConversationId', currentConversationId);
                
                // Update active state in the conversation list
                document.querySelectorAll('.conversation-item').forEach(item => {
                    item.classList.toggle('active', item.dataset.conversationId === conversationId);
                });
                
                updateConversationList(conversationList);
            })
            .catch(error => {
                console.error('Error loading conversation:', error);
                if (error.message === 'Conversation not found') {
                    appendMessage('This conversation could not be found. It may have been deleted.', 'system');
                    // Remove the conversation from local storage and update the list
                    localStorage.removeItem(conversationId);
                    updateConversationList(conversationList);
                } else {
                    appendMessage('Failed to load conversation. Please try again later.', 'system');
                }
                // Clear the current conversation ID
                currentConversationId = null;
            });
    }

    function deleteConversation(conversationId) {
        localStorage.removeItem(conversationId);
        if (conversationId === currentConversationId) {
            clearMessages();
            currentConversationId = null;
        }
        updateConversationList(conversationList);
    }

    function createDeleteConfirmationModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Confirm Delete</h2>
                <p>Are you sure you want to delete this conversation?</p>
                <div class="modal-buttons">
                    <button id="confirm-delete">Delete</button>
                    <button id="cancel-delete">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }
    
    const deleteConfirmationModal = createDeleteConfirmationModal();
    
    function showDeleteConfirmation(conversationId) {
        deleteConfirmationModal.style.display = 'flex';
        const confirmButton = document.getElementById('confirm-delete');
        const cancelButton = document.getElementById('cancel-delete');
    
        const closeModal = () => {
            deleteConfirmationModal.style.display = 'none';
            document.removeEventListener('click', handleOutsideClick);
        };
    
        const handleOutsideClick = (event) => {
            if (!event.target.closest('.modal-content')) {
                closeModal();
            }
        };
    
        confirmButton.onclick = () => {
            deleteConversation(conversationId);
            closeModal();
        };
    
        cancelButton.onclick = closeModal;
    
        // Add event listener for clicks outside the modal
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 0);
    }


    function updateConversationList(conversationList) {
        if (!conversationList) {
            console.error('Conversation list element not found');
            return;
        }
        conversationList.innerHTML = '';
        const conversations = Object.keys(localStorage)
            .filter(key => key.startsWith('conv_'))
            .map(key => ({
                id: key,
                data: JSON.parse(localStorage.getItem(key) || '{}'),
                timestamp: parseInt(key.split('_')[1])
            }))
            .sort((a, b) => b.timestamp - a.timestamp);
    
        conversations.forEach(conv => {
            if (conv.data.messages && conv.data.messages.length > 0) {
                const listItem = document.createElement('div');
                listItem.className = 'conversation-item';
                listItem.dataset.conversationId = conv.id;
                let title = conv.data.title || `Conversation ${new Date(conv.timestamp).toLocaleString()}`;
                title = title.replace(/^"|"$/g, '').trim();
                if (title === '') {
                    title = `Conversation ${new Date(conv.timestamp).toLocaleString()}`;
                }
                
                const titleSpan = document.createElement('span');
                titleSpan.textContent = title;
                titleSpan.className = 'conversation-title';
                titleSpan.dataset.conversationId = conv.id;
                
                titleSpan.addEventListener('click', () => {
                    if (conv.id !== currentConversationId) {
                        loadConversation(conv.id);
                    }
                });
                
                const menuIcon = document.createElement('span');
                menuIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-more-vertical"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
                menuIcon.className = 'menu-icon';
                menuIcon.style.display = 'none'; // Hide menu icon by default
                
                const menuOptions = document.createElement('div');
                menuOptions.className = 'menu-options';
                menuOptions.style.display = 'none';
                
                const renameOption = document.createElement('span');
                renameOption.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg> Rename`;
                renameOption.className = 'rename-option';
                renameOption.addEventListener('click', (e) => {
                    e.stopPropagation();
                    renameConversation(conv.id, titleSpan);
                    menuOptions.style.display = 'none'; // Hide menu after clicking
                });
                
                const deleteOption = document.createElement('span');
                deleteOption.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg> Delete`;
                deleteOption.className = 'delete-option';
                deleteOption.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showDeleteConfirmation(conv.id);
                    menuOptions.style.display = 'none'; // Hide menu after clicking
                });
                
                menuOptions.appendChild(renameOption);
                menuOptions.appendChild(deleteOption);
                
                menuIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menuOptions.style.display = menuOptions.style.display === 'none' ? 'block' : 'none';
                });
                
                listItem.appendChild(titleSpan);
                listItem.appendChild(menuIcon);
                listItem.appendChild(menuOptions);
                
                // Add hover event listeners to show/hide menu icon
                listItem.addEventListener('mouseenter', () => {
                    menuIcon.style.display = 'inline-block';
                });
                listItem.addEventListener('mouseleave', () => {
                    menuIcon.style.display = 'none';
                    menuOptions.style.display = 'none'; // Hide menu options when leaving the item
                });
                
                if (conv.id === currentConversationId) {
                    listItem.classList.add('active');
                }
                conversationList.appendChild(listItem);
            }
        });
    }
    
    conversationList.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('conversation-title')) {
            const titleSpan = e.target;
            const input = document.createElement('input');
            input.value = titleSpan.textContent;
            input.className = 'edit-title-input';
            input.dataset.conversationId = titleSpan.dataset.conversationId;
            titleSpan.replaceWith(input);
            input.focus();
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const newTitle = input.value.trim();
                    const conversationId = input.dataset.conversationId;
                    if (newTitle && conversationId) {
                        const conversationData = JSON.parse(localStorage.getItem(conversationId) || '{}');
                        conversationData.title = newTitle;
                        localStorage.setItem(conversationId, JSON.stringify(conversationData));
                        updateConversationList(conversationList);
                    }
                }
            });
            
            input.addEventListener('blur', () => {
                updateConversationList(conversationList);
            });
        }
    });

    // Then in your scripts.js
    function appendMessage(text, type) {
        if (chatMessages) {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${type}`;
            
            if (type === 'bot') {
                try {
                    // Use DOMPurify to sanitize the HTML output from marked

                    messageElement.innerHTML = DOMPurify.sanitize(marked.parse(text));
                } catch (error) {
                    console.error('Error parsing markdown:', error);
                    messageElement.textContent = text;
                }
            } else {
                messageElement.textContent = text;
            }
            
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    
    function sendMessage(event) {
        event.preventDefault();
        const message = messageInput.value.trim();
        if (message !== '') {
            appendMessage(message, 'user');
            saveMessage(message, 'user');
            messageInput.value = '';
            adjustInputHeight();
    
            const botMessageElement = document.createElement('div');
            botMessageElement.className = 'message bot';
            chatMessages.appendChild(botMessageElement);
    
            const eventSource = new EventSource(`/chat?conversationId=${currentConversationId}&message=${encodeURIComponent(message)}`);
            
            let fullResponse = '';
    
            eventSource.onmessage = function(event) {
                if (event.data === '[DONE]') {
                    eventSource.close();
                    saveMessage(fullResponse, 'bot');
                } else {
                    try {
                        const data = JSON.parse(event.data);
                        if (typeof data === 'string') {
                            // This is a regular message chunk
                            fullResponse += data;
                            botMessageElement.innerHTML = DOMPurify.sanitize(marked.parse(fullResponse));
                        } else if (data.event === 'title') {
                            console.log('Received title event:', data.title); // Add this log
                            saveMessage('', 'system', data.title);
                            updateConversationList(conversationList);
                            // Update the current conversation's title in the UI
                            const activeConversation = document.querySelector('.conversation-item.active .conversation-title');
                            if (activeConversation) {
                                activeConversation.textContent = data.title;
                            }
                        }
                    } catch (error) {
                        console.error('Error parsing SSE data:', error);
                    }
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }
            };
            eventSource.onerror = function(error) {
                console.error('EventSource failed:', error);
                eventSource.close();
                botMessageElement.textContent = 'Sorry, there was an error processing your request.';
                saveMessage('Sorry, there was an error processing your request.', 'bot');
            };
        }
    }

    function adjustInputHeight() {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    }

    function updateThemeIcon() {
        const isDarkTheme = body.classList.contains('dark-theme');
        themeToggle.innerHTML = isDarkTheme
            ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39.39 1.03 0 1.41s-1.03.39-1.41 0l-1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39.39 1.03 0 1.41s-1.03.39-1.41 0l-1.06-1.06z"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>';
    }

    // Event Listeners
    if (newChatButton) {
        newChatButton.addEventListener('click', startNewConversation);
    }

    if (chatForm) {
        chatForm.addEventListener('submit', sendMessage);
    }

    if (messageInput) {
        messageInput.addEventListener('input', adjustInputHeight);
        messageInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage(event);
            }
        });
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-theme');
            updateThemeIcon();
            localStorage.setItem('theme', body.classList.contains('dark-theme') ? 'dark' : 'light');
        });
    }

    const sidebar = document.getElementById('sidebar');
    const toggleSidebar = document.getElementById('toggle-sidebar');

    function toggleSidebarVisibility() {
        sidebar.classList.toggle('minimized');
        localStorage.setItem('sidebarMinimized', sidebar.classList.contains('minimized'));
    }

    if (toggleSidebar) {
        toggleSidebar.addEventListener('click', toggleSidebarVisibility);
    }

    // Initialization
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
    }
    updateThemeIcon();

    const sidebarMinimized = localStorage.getItem('sidebarMinimized');
    if (sidebarMinimized === 'true') {
        sidebar.classList.add('minimized');
    }

    // Initialization
    const lastConversationId = localStorage.getItem('lastConversationId');
    if (lastConversationId) {
        loadConversation(lastConversationId);
    } else {
        startNewConversation();
    }

    adjustInputHeight();
    updateConversationList(conversationList);
});

function renameConversation(conversationId, titleSpan) {
    const input = document.createElement('input');
    input.value = titleSpan.textContent;
    input.className = 'edit-title-input';
    input.dataset.conversationId = conversationId;
    titleSpan.replaceWith(input);
    input.focus();
    
    const handleRename = () => {
        const newTitle = input.value.trim();
        if (newTitle) {
            saveNewTitle(conversationId, newTitle);
        }
        updateConversationList(document.getElementById('conversation-list'));
    };

    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleRename();
        }
    });
    
    input.addEventListener('blur', handleRename);
}

function saveNewTitle(conversationId, newTitle) {
    const conversationData = JSON.parse(localStorage.getItem(conversationId) || '{}');
    conversationData.title = newTitle;
    localStorage.setItem(conversationId, JSON.stringify(conversationData));
}

// Make sure updateConversationList is called after saving the new title
function updateConversationList(conversationList) {
    if (!conversationList) {
        console.error('Conversation list element not found');
        return;
    }
    conversationList.innerHTML = '';
    const conversations = Object.keys(localStorage)
        .filter(key => key.startsWith('conv_'))
        .map(key => ({
            id: key,
            data: JSON.parse(localStorage.getItem(key) || '{}'),
            timestamp: parseInt(key.split('_')[1])
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

    conversations.forEach(conv => {
        if (conv.data.messages && conv.data.messages.length > 0) {
            const listItem = document.createElement('div');
            listItem.className = 'conversation-item';
            listItem.dataset.conversationId = conv.id;
            let title = conv.data.title || `Conversation ${new Date(conv.timestamp).toLocaleString()}`;
            title = title.replace(/^"|"$/g, '').trim();
            if (title === '') {
                title = `Conversation ${new Date(conv.timestamp).toLocaleString()}`;
            }
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = title;
            titleSpan.className = 'conversation-title';
            titleSpan.dataset.conversationId = conv.id;
            
            titleSpan.addEventListener('click', () => {
                if (conv.id !== currentConversationId) {
                    loadConversation(conv.id);
                }
            });
            
            const menuIcon = document.createElement('span');
            menuIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-more-vertical"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
            menuIcon.className = 'menu-icon';
            menuIcon.style.display = 'none'; // Hide menu icon by default
            
            const menuOptions = document.createElement('div');
            menuOptions.className = 'menu-options';
            menuOptions.style.display = 'none';
            
            const renameOption = document.createElement('span');
            renameOption.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg> Rename`;
            renameOption.className = 'rename-option';
            renameOption.addEventListener('click', (e) => {
                e.stopPropagation();
                renameConversation(conv.id, titleSpan);
                menuOptions.style.display = 'none'; // Hide menu after clicking
            });
            
            const deleteOption = document.createElement('span');
            deleteOption.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg> Delete`;
            deleteOption.className = 'delete-option';
            deleteOption.addEventListener('click', (e) => {
                e.stopPropagation();
                showDeleteConfirmation(conv.id);
                menuOptions.style.display = 'none'; // Hide menu after clicking
            });
            
            menuOptions.appendChild(renameOption);
            menuOptions.appendChild(deleteOption);
            
            menuIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                menuOptions.style.display = menuOptions.style.display === 'none' ? 'block' : 'none';
            });
            
            listItem.appendChild(titleSpan);
            listItem.appendChild(menuIcon);
            listItem.appendChild(menuOptions);
            
            // Add hover event listeners to show/hide menu icon
            listItem.addEventListener('mouseenter', () => {
                menuIcon.style.display = 'inline-block';
            });
            listItem.addEventListener('mouseleave', () => {
                menuIcon.style.display = 'none';
                menuOptions.style.display = 'none'; // Hide menu options when leaving the item
            });
            
            if (conv.id === currentConversationId) {
                listItem.classList.add('active');
            }
            conversationList.appendChild(listItem);
        }
    });
    
    // After updating the list, reattach event listeners to new elements
    document.querySelectorAll('.rename-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            const conversationId = e.target.closest('.conversation-item').dataset.conversationId;
            const titleSpan = e.target.closest('.conversation-item').querySelector('.conversation-title');
            renameConversation(conversationId, titleSpan);
        });
    });
}
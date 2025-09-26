// Main application
const ChatApp = (() => {
  // DOM Elements
  const messagesContainer = document.getElementById("messages");
  const sendBtn = document.getElementById("send-btn");
  const editorElement = document.getElementById("editor");
  const themeToggle = document.getElementById("theme-toggle");
  const sunIcon = document.getElementById("sun-icon");
  const moonIcon = document.getElementById("moon-icon");
  const newConversationBtn = document.getElementById("new-conversation-btn");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const conversationList = document.getElementById("conversation-list");
  const appContainer = document.querySelector(".app-container");
  const searchInput = document.getElementById("search-conversations");
  const toggleArchivedBtn = document.getElementById("toggle-archived");
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const currentConversationTitle = document.getElementById("current-conversation-title");


  // State
  let conversations = [];
  let currentConversationId = null;
  let isProcessing = false;
  let showArchived = false;
  let editor;

  // Initialize Puter JS
  async function initializePuter() {
    return new Promise((resolve) => {
      const checkPuter = () => {
        if (typeof puter !== 'undefined' && puter.ai) {
          console.log('Puter JS is ready');
          // If Puter requires initialization with an API key, you can do it here:
          // await puter.init({ apiKey: 'your-api-key' });
          resolve(true);
        } else {
          console.log('Waiting for Puter JS to load...');
          setTimeout(checkPuter, 100);
        }
      };
      
      // Start checking
      checkPuter();
      
      // Set a timeout in case Puter JS fails to load
      setTimeout(() => {
        if (typeof puter === 'undefined') {
          console.error('Puter JS failed to load after 5 seconds');
          showNotification('Failed to load AI service. Please check your internet connection and refresh the page.', 'error');
          resolve(false);
        }
      }, 5000);
    });
  }

  // Initialize the app
  async function init() {
    // Initialize Puter JS
    const puterInitialized = await initializePuter();
    if (!puterInitialized) {
      return;
    }
    
    // Initialize CodeMirror editor
    editor = CodeMirror.fromTextArea(editorElement, {
      mode: "markdown",
      theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dracula' : 'default',
      lineWrapping: true,
      placeholder: 'Type your message here...',
      autoCloseBrackets: true,
      matchBrackets: true,
      keyMap: "sublime",
      viewportMargin: Infinity,
      extraKeys: {
        'Enter': (cm) => {
          if (!cm.state.completionActive && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
          } else {
             cm.execCommand("newlineAndIndent");
          }
        },
        'Ctrl-Enter': sendMessage,
        'Cmd-Enter': sendMessage
      }
    });

    loadConversations();
    setupEventListeners();
    
    // Create a default conversation if none exists
    if (conversations.length === 0) {
      createNewConversation();
    } else {
      // Load the most recent conversation that is not archived
      const lastConversation = conversations.find(c => !c.isArchived) || conversations[0];
      loadConversation(lastConversation.id);
    }
    
    // Set up theme
    const savedTheme = localStorage.getItem("theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(savedTheme);

    setTimeout(() => editor.focus(), 100);
  }

  // Set up event listeners
  function setupEventListeners() {
    sidebarToggle?.addEventListener("click", () => appContainer.classList.toggle("sidebar-visible"));
    newConversationBtn?.addEventListener("click", createNewConversation);
    sendBtn?.addEventListener("click", sendMessage);
    searchInput?.addEventListener("input", () => renderConversationList());
    toggleArchivedBtn?.addEventListener("click", () => {
        showArchived = !showArchived;
        toggleArchivedBtn.setAttribute("data-active", showArchived);
        const label = toggleArchivedBtn.querySelector("span");
        if (label) label.textContent = showArchived ? "Hide archived" : "Show archived";
        renderConversationList();
    });
    exportBtn?.addEventListener("click", exportCurrentConversation);
    importBtn?.addEventListener("click", importConversation);

    themeToggle?.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        setTheme(currentTheme === "dark" ? "light" : "dark");
    });

    editor.on('change', () => {
        const wrapper = editor.getWrapperElement();
        const scroller = editor.getScrollerElement();
        if (scroller.scrollHeight > wrapper.clientHeight) {
            wrapper.classList.add('has-scrollbar');
        } else {
            wrapper.classList.remove('has-scrollbar');
        }
        updateSendButtonState();
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", (e) => {
      if (window.innerWidth <= 768 && 
          !e.target.closest(".conversation-sidebar") && 
          !e.target.closest("#sidebar-toggle") &&
          appContainer.classList.contains("sidebar-visible")) {
        appContainer.classList.remove("sidebar-visible");
      }
    });
  }

  // Create a new conversation
  function createNewConversation() {
    const newId = Date.now().toString();
    const newConversation = {
      id: newId,
      title: `New Conversation`,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false
    };
    conversations.unshift(newConversation);
    saveConversations();
    loadConversation(newId);
    editor.focus();
    return newConversation;
  }

  // Load a conversation by ID
  function loadConversation(conversationId) {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    currentConversationId = conversationId;
    localStorage.setItem('current_conversation_id', currentConversationId);
    
    renderMessages();
    renderConversationList();
    editor.focus();
  }
  
  // Save/Load conversations to/from localStorage
  function saveConversations() {
    try {
      localStorage.setItem('chat_conversations', JSON.stringify(conversations));
    } catch (error) {
      console.error('Error saving conversations:', error);
      showNotification('Could not save conversations.', 'error');
    }
  }
  
  function loadConversations() {
    try {
      const saved = localStorage.getItem('chat_conversations');
      conversations = saved ? JSON.parse(saved) : [];
      conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      currentConversationId = localStorage.getItem('current_conversation_id');
    } catch (error) {
      console.error('Error loading conversations:', error);
      conversations = [];
    }
  }

  // Render the conversation list
  function renderConversationList() {
    if (!conversationList) return;
    
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    const filtered = conversations.filter(conv => {
      const matchesArchive = showArchived ? true : !conv.isArchived;
      const title = String(conv.title || '').toLowerCase();
      const content = (conv.messages || []).map(m => m.content).join(' ').toLowerCase();
      const matchesSearch = searchTerm === '' || title.includes(searchTerm) || content.includes(searchTerm);
      return matchesArchive && matchesSearch;
    });

    filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    const activeConversations = filtered.filter(c => !c.isArchived);
    const archivedConversations = filtered.filter(c => c.isArchived);

    let html = '';
    if (activeConversations.length > 0) {
        html += `<div class="conversation-group">
            <div class="conversation-group-title">Active</div>
            ${activeConversations.map(conv => renderConversationItem(conv)).join('')}
        </div>`;
    }
    if (showArchived && archivedConversations.length > 0) {
        html += `<div class="conversation-group">
            <div class="conversation-group-title">Archived</div>
            ${archivedConversations.map(conv => renderConversationItem(conv)).join('')}
        </div>`;
    }
    
    if (filtered.length === 0) {
      html = `<div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <p>${searchTerm ? 'No matching conversations' : 'No conversations yet'}</p>
        <button id="create-first-convo" class="text-btn">Start a new chat</button>
      </div>`;
    }

    conversationList.innerHTML = html;
    
    // Add event listeners after render
    conversationList.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            if (e.target.closest('.archive-btn')) {
                e.stopPropagation();
                toggleArchiveConversation(id);
            } else if (e.target.closest('.delete-btn')) {
                e.stopPropagation();
                deleteConversation(id);
            } else {
                loadConversation(id);
                if (window.innerWidth <= 768) {
                    appContainer.classList.remove("sidebar-visible");
                }
            }
        });
    });
    const createFirstBtn = document.getElementById('create-first-convo');
    createFirstBtn?.addEventListener('click', createNewConversation);
  }
  
  function renderConversationItem(conv) {
    const isActive = conv.id === currentConversationId;
    const lastUpdated = new Date(conv.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const preview = (conv.messages[0]?.content || 'No messages yet').replace(/<[^>]*>?/gm, '').substring(0, 60);

    return `
      <div class="conversation-item ${isActive ? 'active' : ''}" data-id="${conv.id}" role="button" tabindex="0">
        <div class="conversation-item-header">
            <span class="conversation-title">${conv.title}</span>
            <span class="conversation-time">${lastUpdated}</span>
        </div>
        <p class="conversation-preview">${preview}...</p>
        <div class="conversation-actions">
            <button class="icon-btn archive-btn" title="${conv.isArchived ? 'Unarchive' : 'Archive'}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><path d="M10 12h4"></path></svg>
            </button>
            <button class="icon-btn delete-btn" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        </div>
      </div>`;
  }
  
  // Render messages for the current conversation
  function renderMessages() {
    const conversation = conversations.find(c => c.id === currentConversationId);
    
    // Clear messages container first
    messagesContainer.innerHTML = '';
    
    if (!conversation || conversation.messages.length === 0) {
        // Don't show any welcome message when no conversation is started
        currentConversationTitle.textContent = 'New Chat';
        return;
    }
    
    // Only show messages if we have an active conversation with messages
    currentConversationTitle.textContent = conversation.title;

    conversation.messages.forEach(message => {
        if (!message.content) return; // Skip empty messages
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.role}`;
        if (message.isError) messageElement.classList.add('error');

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Ensure message content is a string and format it
        const messageContent = String(message.content || '');
        const formattedContent = messageContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
            
        contentDiv.innerHTML = formattedContent;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageElement.appendChild(contentDiv);
        messageElement.appendChild(timeDiv);
        messagesContainer.appendChild(messageElement);
    });
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  // Conversation actions
  function toggleArchiveConversation(id) {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      conv.isArchived = !conv.isArchived;
      conv.updatedAt = new Date().toISOString();
      saveConversations();
      renderConversationList();
      showNotification(`Conversation ${conv.isArchived ? 'archived' : 'unarchived'}.`);
    }
  }
  
  function deleteConversation(id) {
    if (!confirm('Are you sure you want to permanently delete this conversation?')) return;
    
    conversations = conversations.filter(c => c.id !== id);
    
    if (id === currentConversationId) {
        const nextConv = conversations.find(c => !c.isArchived) || conversations[0];
        if (nextConv) {
            loadConversation(nextConv.id);
        } else {
            createNewConversation();
        }
    }
    
    saveConversations();
    renderConversationList();
  }

  function addMessageToCurrentConversation(message) {
    try {
      // Validate input
      if (!message || typeof message !== 'object') {
        console.error('Invalid message format:', message);
        return;
      }
      
      // Ensure required fields exist and are properly formatted
      const validMessage = {
        role: String(message.role || 'user'),
        content: String(message.content || ''),
        timestamp: message.timestamp || new Date().toISOString(),
        ...(message.isError && { isError: true })
      };
      
      // Find the current conversation
      const conversation = conversations.find(c => c.id === currentConversationId);
      if (!conversation) {
        console.error('No active conversation found');
        return;
      }
      
      // Ensure conversation.messages is a valid array
      if (!Array.isArray(conversation.messages)) {
        conversation.messages = [];
      }
      
      // Add the message
      conversation.messages.push(validMessage);
      
      // Update conversation metadata
      conversation.updatedAt = new Date().toISOString();
      
      // Update the conversation title if it's the first message
      if (conversation.messages.length === 1 && validMessage.content) {
        const title = validMessage.content
          .replace(/[^\w\s]/gi, '') // Remove special characters
          .trim()
          .split('\n')[0] // Take first line
          .slice(0, 30) // Limit length
          .trim();
        conversation.title = title || 'New Conversation';
      }
      
      // Sort conversations by updated time
      conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      
      // Save and update UI
      saveConversations();
      renderMessages();
      renderConversationList();
      
      // Auto-scroll to bottom of messages
      setTimeout(() => {
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 0);
      
    } catch (error) {
      console.error('Error in addMessageToCurrentConversation:', error);
      showNotification('Failed to add message to conversation', 'error');
    }
  }

  // Send message to AI
  async function sendMessage() {
    const content = editor.getValue().trim();
    if (!content || isProcessing) return;

    // Add user message to chat
    const userMessage = { 
      role: 'user', 
      content: content,
      timestamp: new Date().toISOString()
    };
    
    // Add to conversation
    addMessageToCurrentConversation(userMessage);
    
    // Clear input and update state
    editor.setValue("");
    editor.focus();
    isProcessing = true;
    updateSendButtonState();

    // Show typing indicator
    showTypingIndicator();

    try {
      // Get the current conversation
      const conversation = conversations.find(c => c.id === currentConversationId);
      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Prepare messages for the API (last 10 messages)
      const recentMessages = conversation.messages
        .filter(msg => msg && typeof msg === 'object' && 'role' in msg && 'content' in msg)
        .slice(-10)
        .map(({ role, content }) => ({ role, content }));

      console.log("Sending to Puter AI:", recentMessages);

      // Send to AI - using the simpler approach from the working example
      const response = await puter.ai.chat(recentMessages);

      console.log("Received from Puter AI:", response);

      // Process the response
      if (response && response.message && response.message.content) {
        // Add AI response to conversation
        const assistantMessage = {
          role: 'assistant',
          content: response.message.content,
          timestamp: new Date().toISOString()
        };
        
        addMessageToCurrentConversation(assistantMessage);
      } else {
        throw new Error("Invalid response format from AI");
      }
      
    } catch (error) {
      console.error('Error in sendMessage:', error);
      
      // Simplified error handling similar to the working example
      const errorMessage = error.message || 'An error occurred. Please try again.';
      
      // Add error message to chat
      const errorResponse = {
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      addMessageToCurrentConversation(errorResponse);
      showNotification(errorMessage, 'error');
      
    } finally {
      // Clean up
      hideTypingIndicator();
      isProcessing = false;
      updateSendButtonState();
      
      // Auto-scroll to bottom of messages
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }
  }

  // UI Helpers
  function updateSendButtonState() {
    const hasContent = editor && editor.getValue().trim().length > 0;
    sendBtn.disabled = !hasContent || isProcessing;
  }
  
  function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
  
  function hideTypingIndicator() {
    document.getElementById('typing-indicator')?.remove();
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    editor.setOption("theme", theme === 'dark' ? 'dracula' : 'default');
    sunIcon.style.display = theme === 'dark' ? 'block' : 'none';
    moonIcon.style.display = theme === 'dark' ? 'none' : 'block';
  }

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `toast ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('visible');
    }, 10);
    setTimeout(() => {
        notification.classList.remove('visible');
        notification.addEventListener('transitionend', () => notification.remove());
    }, 3000);
  }

  // Import / Export
  function exportCurrentConversation() {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) return showNotification('No active conversation to export.', 'error');
    
    const dataStr = JSON.stringify(conversation, null, 2);
    const blob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = `conversation-${conversation.id}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }
  
  function importConversation() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const importedConv = JSON.parse(e.target.result);
          if (!importedConv.id || !importedConv.messages || !Array.isArray(importedConv.messages)) {
            throw new Error('Invalid conversation format');
          }
          
          const newId = Date.now().toString();
          const newConversation = { ...importedConv, id: newId, isArchived: false };
          
          conversations.unshift(newConversation);
          saveConversations();
          loadConversation(newId);
          showNotification('Conversation imported successfully!', 'success');
        } catch (error) {
          console.error('Error importing conversation:', error);
          showNotification('Failed to import file.', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  
  // Public API
  return { init };
})();

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', ChatApp.init);
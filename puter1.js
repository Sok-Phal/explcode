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
  const editTitleBtn = document.getElementById("edit-title-btn");


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

  // Toggle history section
  function toggleHistorySection() {
    const historySection = document.getElementById('history-section');
    const toggleButton = document.getElementById('toggle-history');
    
    if (historySection && toggleButton) {
      const isCollapsed = historySection.classList.toggle('collapsed');
      toggleButton.classList.toggle('collapsed', isCollapsed);
      localStorage.setItem('historyCollapsed', isCollapsed);
    }
  }
  
  // Initialize the app
  async function init() {
    // Initialize Puter JS
    const puterInitialized = await initializePuter();
    if (!puterInitialized) {
      return;
    }
    
    // Set initial state of history section
    const isHistoryCollapsed = localStorage.getItem('historyCollapsed') === 'true';
    if (isHistoryCollapsed) {
      const historySection = document.getElementById('history-section');
      const toggleButton = document.getElementById('toggle-history');
      if (historySection && toggleButton) {
        historySection.classList.add('collapsed');
        toggleButton.classList.add('collapsed');
      }
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
      // Try to load the last active conversation, or the most recent one
      const savedConversationId = localStorage.getItem('current_conversation_id');
      const lastActiveConversation = conversations.find(c => c.id === savedConversationId);
      const lastConversation = lastActiveConversation || 
                             conversations.find(c => !c.isArchived) || 
                             conversations[0];
      
      if (lastConversation) {
        // Use a small timeout to ensure the DOM is ready
        setTimeout(() => {
          loadConversation(lastConversation.id);
        }, 0);
      }
    }
    
    // Set up theme
    const savedTheme = localStorage.getItem("theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(savedTheme);

    setTimeout(() => editor.focus(), 100);
  }

  // Update conversation title
  function updateConversationTitle() {
    if (!currentConversationId) return;
    
    const newTitle = currentConversationTitle.textContent.trim() || 'Untitled';
    const conversation = conversations.find(c => c.id === currentConversationId);
    
    if (conversation && conversation.title !== newTitle) {
      conversation.title = newTitle;
      conversation.updatedAt = new Date().toISOString();
      saveConversations();
      renderConversationList();
    }
    
    // Ensure the title is not empty
    currentConversationTitle.textContent = newTitle;
  }

  // Set up event listeners
  function setupEventListeners() {
    // Title editing
    currentConversationTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        currentConversationTitle.blur();
      } else if (e.key === 'Escape') {
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (conversation) {
          currentConversationTitle.textContent = conversation.title || 'New Chat';
        } else {
          currentConversationTitle.textContent = 'New Chat';
        }
        currentConversationTitle.blur();
      }
    });

    currentConversationTitle.addEventListener('blur', () => {
      updateConversationTitle();
    });

    editTitleBtn?.addEventListener('click', () => {
      currentConversationTitle.focus();
      // Move cursor to end of text
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(currentConversationTitle);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    });
    sidebarToggle?.addEventListener("click", () => appContainer.classList.toggle("sidebar-visible"));
    document.getElementById('toggle-history')?.addEventListener("click", toggleHistorySection);
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
    const newConversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false
    };
    
    conversations.unshift(newConversation);
    currentConversationId = newConversation.id;
    saveConversations();
    renderConversationList();
    renderMessages();
    
    // Update the title in the UI
    currentConversationTitle.contentEditable = 'true';
    currentConversationTitle.textContent = 'New Chat';
    currentConversationTitle.focus();
    
    // Add event listener to save the title when the user presses Enter
    currentConversationTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const newTitle = currentConversationTitle.textContent.trim();
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (conversation && newTitle !== conversation.title) {
          conversation.title = newTitle;
          conversation.updatedAt = new Date().toISOString();
          saveConversations();
          renderConversationList();
        }
        currentConversationTitle.blur();
      }
    });
    
    return newConversation;
  }

  // Load a conversation by ID
  function loadConversation(conversationId) {
    const conversation = conversations.find(c => c.id === conversationId);
    if (!conversation) return;
    
    // Update the current conversation ID and title
    currentConversationId = conversationId;
    currentConversationTitle.textContent = conversation.title || 'New Chat';
    
    // Store the conversation ID in localStorage
    localStorage.setItem('current_conversation_id', currentConversationId);
    
    // Update the UI to reflect the active conversation
    updateActiveConversationUI(conversationId);
    
    // Render messages and update the conversation list
    renderMessages();
    renderConversationList();
    
    // Focus the editor if it exists
    if (editor) {
      editor.focus();
    }
    
    return conversation;
  }
  
  // Helper function to update the active conversation UI
  function updateActiveConversationUI(conversationId) {
    // Safely remove active class from all conversation items
    const allItems = document.querySelectorAll('.conversation-item');
    if (allItems && allItems.length > 0) {
      allItems.forEach(item => {
        if (item && item.classList) {
          item.classList.remove('active-conversation');
        }
      });
      
      // Add active class to selected conversation if it exists in the DOM
      const selectedItem = document.querySelector(`.conversation-item[data-id="${conversationId}"]`);
      if (selectedItem) {
        selectedItem.classList.add('active-conversation');
        // Smoothly scroll the active item into view if needed
        selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
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
      <div class="conversation-item ${isActive ? 'active-conversation' : ''}" data-id="${conv.id}" role="button" tabindex="0">
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
  
  // Escape HTML to prevent XSS
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Process message content to handle markdown formatting
  function processMarkdownContent(content) {
    const container = document.createElement('div');

    // Split into code fence parts first
    const parts = String(content).split(/(```[\s\S]*?```)/g);

    const processTextPart = (text) => {
      // Escape HTML in normal text to prevent XSS
      text = escapeHtml(text);

      // Process headings (h1-h6)
      text = text.replace(/^#{1,6}\s+(.+)$/gm, (match, heading) => {
        const level = Math.min(6, (match.match(/#/g) || []).length);
        return `<h${level}>${heading}</h${level}>`;
      });

      // Process blockquotes
      text = text.replace(/^>\s+(.+)$/gm, (match, quote) => {
        return `<blockquote>${quote}</blockquote>`;
      });

      // Process unordered lists
      text = text.replace(/^(\s*[-*+]\s+.+$\n?)+/gm, (match) => {
        const items = match.trim().split('\n');
        const listItems = items.map(item =>
          `<li>${item.replace(/^\s*[-*+]\s+/, '').trim()}</li>`
        ).join('');
        return `<ul>${listItems}</ul>`;
      });

      // Process ordered lists
      text = text.replace(/^(\s*\d+\.\s+.+$\n?)+/gm, (match) => {
        const items = match.trim().split('\n');
        const listItems = items.map(item =>
          `<li>${item.replace(/^\s*\d+\.\s+/, '').trim()}</li>`
        ).join('');
        return `<ol>${listItems}</ol>`;
      });

      // Horizontal rules
      text = text.replace(/^[-*_]{3,}$/gm, '<hr>');

      // Inline formatting
      text = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/~~(.*?)~~/g, '<del>$1</del>'); // Strikethrough

      // Links (only http/https)
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        if (/^https?:\/\//.test(url)) {
          return `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
        }
        return linkText;
      });

      // Paragraphs (don’t wrap if already block-level)
      return text.split('\n\n').map(paragraph => {
        if (!paragraph.trim()) return '';
        if (/^<(h[1-6]|ul|ol|li|blockquote|hr|pre|code)/i.test(paragraph.trim())) {
          return paragraph;
        }
        return `<p>${paragraph.replace(/\n/g, '<br>')}</p>`;
      }).join('');
    };

    parts.forEach((part) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // Handle code blocks (don’t escape inside)
        let codeContent = part.slice(3, -3).trim();
        let language = 'text';

        // Extract optional language hint
        const firstNewLine = codeContent.indexOf('\n');
        if (firstNewLine > 0) {
          const potentialLang = codeContent.substring(0, firstNewLine).trim();
          if (potentialLang && /^[a-zA-Z0-9_-]+$/.test(potentialLang)) {
            language = potentialLang.toLowerCase();
            codeContent = codeContent.substring(firstNewLine + 1).trim();
          }
        }

        // Create code block container
        const codeBlock = document.createElement('div');
        codeBlock.className = 'code-block';

        const header = document.createElement('div');
        header.className = 'code-block-header';
        header.innerHTML = `
          <span class="code-language">${language}</span>
          <button class="copy-btn" title="Copy to clipboard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>
        `;

        const codeContentDiv = document.createElement('div');
        codeContentDiv.className = 'code-block-content';

        const pre = document.createElement('pre');
        const codeElement = document.createElement('code');
        codeElement.textContent = codeContent; // <body> shows as <body>
        pre.appendChild(codeElement);

        codeContentDiv.appendChild(pre);

        // Add copy functionality
        const copyBtn = header.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(codeContent).then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Copied!</span>
            `;
            setTimeout(() => {
              copyBtn.classList.remove('copied');
              copyBtn.innerHTML = originalHTML;
            }, 2000);
          });
        });

        codeBlock.appendChild(header);
        codeBlock.appendChild(codeContentDiv);
        container.appendChild(codeBlock);

      } else if (part.trim()) {
        // Non-code: escape + markdown process
        const processed = processTextPart(part);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = processed;

        // Handle tables as plain text
        const tableElements = tempDiv.querySelectorAll('table');
        tableElements.forEach(table => {
          const rows = [];
          table.querySelectorAll('tr').forEach(row => {
            const rowData = [];
            row.querySelectorAll('th, td').forEach(cell => {
              rowData.push(cell.textContent);
            });
            rows.push(rowData.join(' | '));
          });
          const pre = document.createElement('pre');
          pre.textContent = rows.join('\n');
          table.parentNode.replaceChild(pre, table);
        });

        // Handle blockquotes as > text
        const blockquotes = tempDiv.querySelectorAll('blockquote');
        blockquotes.forEach(blockquote => {
          blockquote.textContent = '> ' + blockquote.textContent;
        });

        while (tempDiv.firstChild) {
          container.appendChild(tempDiv.firstChild);
        }
      }
    });

    return container;
  }


  // Initialize CodeMirror for a code block
  function initializeCodeBlock(container) {
    if (!container) return;
  
    // Find all code blocks inside this container
    const codeBlocks = container.querySelectorAll('.code-block');
  
    codeBlocks.forEach((block) => {
      // Safely get the <code> element
      const codeEl = block.querySelector('code');
      if (!codeEl) return; // skip if no code element
  
      const codeText = codeEl.textContent || '';
  
      // Safely get language label
      const langEl = block.querySelector('.code-block-header span');
      const language = langEl?.textContent || 'text';
  
      // Copy button inside this block
      const copyBtn = block.querySelector('.copy-btn');
      if (!copyBtn) return;
  
      // Remove previous event listeners to avoid duplicate bindings
      copyBtn.replaceWith(copyBtn.cloneNode(true));
      const newCopyBtn = block.querySelector('.copy-btn');
  
      newCopyBtn.addEventListener('click', () => {
        // Copy the code content to clipboard
        navigator.clipboard.writeText(codeText).then(() => {
          const originalHTML = newCopyBtn.innerHTML;
          newCopyBtn.classList.add('copied');
          newCopyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Copied!</span>
          `;
          setTimeout(() => {
            newCopyBtn.classList.remove('copied');
            newCopyBtn.innerHTML = originalHTML;
          }, 2000);
        });
      });
    });
  }
  

  // Add copy functionality with improved feedback
  function setupCodeCopyButtons(container) {
    if (!container) return;
  
    const blocks = container.querySelectorAll('.code-block');
    blocks.forEach(block => {
      const header = block.querySelector('.code-block-header');
      if (!header) return; // skip if header not found
  
      const copyBtn = block.querySelector('.copy-btn');
      if (!copyBtn) return;
  
      // Remove previous listeners
      copyBtn.replaceWith(copyBtn.cloneNode(true));
      const newCopyBtn = block.querySelector('.copy-btn');
      
      newCopyBtn.addEventListener('click', () => {
        const codeEl = block.querySelector('code');
        const codeText = codeEl?.textContent || '';
        navigator.clipboard.writeText(codeText);
      });
    });
  }
  

  // Render messages for the current conversation
  function renderMessages() {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) return;

    // Always set the title from the conversation object
    currentConversationTitle.textContent = conversation.title || 'New Chat';

    // Clear the messages container
    messagesContainer.innerHTML = '';

    // If no messages, just return after setting title
    if (!conversation.messages || conversation.messages.length === 0) {
      return;
    }

    conversation.messages.forEach(message => {
      if (!message.content) return;

      const messageElement = document.createElement('div');
      messageElement.className = `message ${message.role}`;
      if (message.isError) messageElement.classList.add('error');

      // Create message header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'message-header';
      
      // Add role icon based on message role
      let roleIcon = '';
      let roleText = message.role === 'user' ? 'You' : 'Assistant';
      
      if (message.role === 'user') {
        roleIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
      } else if (message.role === 'assistant') {
        roleIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>';
      } else if (message.role === 'system') {
        roleText = 'System';
        roleIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>';
      }
      
      // Add timestamp
      const timestamp = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Add copy button to header
      headerDiv.innerHTML = `
        <div class="message-role">
          <span class="role-icon">${roleIcon}</span>
          <span class="role-text">${roleText}</span>
        </div>
        <div class="message-actions">
          <button class="copy-message-btn" title="Copy message">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <span class="message-time">${timestamp}</span>
        </div>
      `;
      
      // Create message content container
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';

      // Process message content with markdown/code blocks
      const messageContent = String(message.content || '');
      const processedContent = processMarkdownContent(messageContent);
      contentDiv.appendChild(processedContent);

      // Store raw content for copy button
      messageElement.dataset.messageContent = messageContent.replace(/<[^>]*>?/gm, '');

      // Assemble message element
      messageElement.appendChild(headerDiv);
      messageElement.appendChild(contentDiv);
      messagesContainer.appendChild(messageElement);
    });

    // Initialize code blocks and copy buttons
    document.querySelectorAll('.code-block').forEach(block => initializeCodeBlock(block));
    setupCodeCopyButtons();
    
    // Add event listeners for message copy buttons
    document.querySelectorAll('.copy-message-btn').forEach(button => {
      button.addEventListener('click', async (e) => {
        e.stopPropagation();
        const messageElement = button.closest('.message');
        const messageContentEl = messageElement.querySelector('.message-content');

        if (messageContentEl) {
          try {
            let fullText = '';

            // Walk through children so we can detect code blocks
            messageContentEl.childNodes.forEach(node => {
              if (node.classList && node.classList.contains('code-block')) {
                // Handle code block specially
                const code = node.querySelector('code')?.textContent || '';
                const lang = node.querySelector('.code-block-header span')?.textContent || '';
                fullText += `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
              } else {
                // Normal text
                fullText += node.innerText + '\n';
              }
            });

            await navigator.clipboard.writeText(fullText.trim());

            // Visual feedback
            button.classList.add('copied');
            const originalHTML = button.innerHTML;
            button.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            `;
            setTimeout(() => {
              button.classList.remove('copied');
              button.innerHTML = originalHTML;
            }, 2000);

            showNotification('Message copied with formatting!');
          } catch (err) {
            console.error('Failed to copy message:', err);
            showNotification('Failed to copy message', 'error');
          }
        }
      });
    });
    
    // Scroll to bottom
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
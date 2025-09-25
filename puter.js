document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const messagesDiv = document.getElementById("messages");
  const sendBtn = document.getElementById("send-btn");
  const editorElement = document.getElementById("editor");
  const themeToggle = document.getElementById("theme-toggle");
  const sunIcon = document.getElementById("sun-icon");
  const moonIcon = document.getElementById("moon-icon");

  // State
  const conversation = [];
  let isProcessing = false;

  // Initialize CodeMirror
  const editor = CodeMirror.fromTextArea(editorElement, {
    mode: "javascript",
    theme: "default",
    lineNumbers: false,
    lineWrapping: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    placeholder: "Type your message or code here...",
    extraKeys: {
      "Ctrl-Enter": sendMessage,
      "Cmd-Enter": sendMessage,
      "Shift-Enter": "newlineAndIndentKeepMarkers",
    },
    viewportMargin: Infinity,
    scrollbarStyle: "null",
    lineWiseCopyCut: false,
  });

  // Theme Toggle
  const savedTheme =
    localStorage.getItem("theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateIcons(savedTheme);

  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateIcons(newTheme);
  });

  // Auto-resize the editor
  editor.on("change", function () {
    updateSendButtonState();
    autoResizeEditor();
  });

  function autoResizeEditor() {
    const scrollHeight = editor.doc.height;
    const lineHeight = editor.defaultTextHeight();
    const maxHeight = window.innerWidth < 640 ? 150 : 200;
    const newHeight = Math.min(
      Math.max(scrollHeight * lineHeight, 60),
      maxHeight
    );

    editor.setSize(null, newHeight);
    document.querySelector(".CodeMirror").style.height = newHeight + "px";
  }

  // Initial resize
  setTimeout(autoResizeEditor, 0);

  // Handle window resize
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(autoResizeEditor, 100);
  });

  // Event Listeners
  sendBtn.addEventListener("click", sendMessage);
  editor.on("keydown", (cm, event) => {
    if (event.key === "Enter" && event.shiftKey) {
      // Allow Shift+Enter for new lines
      return;
    } else if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  // Update send button state based on input
  function updateSendButtonState() {
    const hasContent = editor.getValue().trim().length > 0;
    sendBtn.disabled = !hasContent || isProcessing;
  }

  // Add a new message to the chat
  function addMessage(content, sender) {
    const messageElement = document.createElement("div");
    messageElement.className = `message ${sender}`;
    messageElement.style.position = "relative"; // For absolute positioning of copy button

    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const header = document.createElement("div");
    header.className = "message-header";
    header.innerHTML = `
      <span>${sender === "user" ? "You" : "AI Assistant"}</span>
      <span class="message-time">${timeString}</span>
    `;

    messageElement.appendChild(header);

    // Add copy button for AI messages
    if (sender === "ai") {
      const copyBtn = document.createElement("button");
      copyBtn.className = "copy-message-btn";
      copyBtn.title = "Copy message";
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      `;

      copyBtn.addEventListener("click", () => {
        navigator.clipboard
          .writeText(content)
          .then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
            setTimeout(() => {
              copyBtn.innerHTML = originalHTML;
            }, 2000);
          })
          .catch((err) => {
            console.error("Failed to copy message: ", err);
          });
      });

      messageElement.appendChild(copyBtn);
    }

    // Process message content for code blocks
    const contentWithCode = processMessageContent(content);
    const contentContainer = document.createElement("div");
    contentContainer.className = "message-content";
    contentContainer.appendChild(contentWithCode);

    messageElement.appendChild(contentContainer);
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Process message content to handle code blocks
  function processMessageContent(content) {
    const container = document.createElement("div");

    // Split content by code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);

    parts.forEach((part) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        // This is a code block
        const codeContent = part.slice(3, -3).trim();
        const firstNewLine = codeContent.indexOf("\n");

        let language = "text";
        let code = codeContent;

        if (firstNewLine > 0) {
          const potentialLang = codeContent.substring(0, firstNewLine).trim();
          if (potentialLang && /^[a-zA-Z0-9_-]+$/.test(potentialLang)) {
            language = potentialLang.toLowerCase();
            code = codeContent.substring(firstNewLine).trim();
          }
        }

        // Create code block container
        const codeBlock = document.createElement("div");
        codeBlock.className = "code-block";

        // Add code block header
        const header = document.createElement("div");
        header.className = "code-block-header";
        header.innerHTML = `
          <span>${language}</span>
          <button class="copy-btn" title="Copy to clipboard">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>
        `;

        // Add code content
        const codeContentDiv = document.createElement("div");
        codeContentDiv.className = "code-block-content";

        const pre = document.createElement("pre");
        const codeElement = document.createElement("code");

        // Apply syntax highlighting if available
        try {
          const mode = CodeMirror.findModeByName(language) ||
            CodeMirror.findModeByMIME(`text/${language}`) ||
            CodeMirror.findModeByExtension(language) || { mime: "text/plain" };

          CodeMirror.runMode(code, mode.mime, codeElement);
        } catch (e) {
          console.error("Error highlighting code:", e);
          codeElement.textContent = code;
        }

        pre.appendChild(codeElement);
        codeContentDiv.appendChild(pre);

        // Add copy functionality
        const copyBtn = header.querySelector(".copy-btn");
        copyBtn.addEventListener("click", () => {
          navigator.clipboard
            .writeText(code)
            .then(() => {
              const originalHTML = copyBtn.innerHTML;
              copyBtn.classList.add("copied");
              copyBtn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Copied!</span>
            `;
              setTimeout(() => {
                copyBtn.classList.remove("copied");
                copyBtn.innerHTML = originalHTML;
              }, 2000);
            })
            .catch((err) => {
              console.error("Failed to copy text: ", err);
            });
        });

        // Append elements
        codeBlock.appendChild(header);
        codeBlock.appendChild(codeContentDiv);
        container.appendChild(codeBlock);
      } else if (part.trim()) {
        // Regular text content
        const textElement = document.createElement("div");
        // Convert newlines to <br> and handle markdown-style formatting
        const formattedText = part
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold
          .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italic
          .replace(/`([^`]+)`/g, "<code>$1</code>") // Inline code
          .replace(/\n/g, "<br>"); // New lines

        textElement.innerHTML = formattedText;
        container.appendChild(textElement);
      }
    });

    return container;
  }

  // Show typing indicator
  function showTyping() {
    const typingElement = document.createElement("div");
    typingElement.className = "typing";
    typingElement.id = "typing-indicator";
    typingElement.textContent = "AI is thinking";
    messagesDiv.appendChild(typingElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Remove typing indicator
  function removeTyping() {
    const typingElement = document.getElementById("typing-indicator");
    if (typingElement) {
      typingElement.remove();
    }
  }

  // Send message to AI
  async function sendMessage() {
    const message = editor.getValue().trim();
    if (!message || isProcessing) return;

    // Add user message to chat
    addMessage(message, "user");
    conversation.push({ role: "user", content: message });

    // Clear input and update state
    editor.setValue("");
    updateSendButtonState();
    isProcessing = true;
    sendBtn.disabled = true;

    // Show typing indicator
    showTyping();

    try {
      // Send to AI
      const response = await puter.ai.chat(conversation);

      // Remove typing indicator
      removeTyping();

      if (response && response.message && response.message.content) {
        // Add AI response to chat
        addMessage(response.message.content, "ai");
        conversation.push(response.message);
      } else {
        throw new Error("Invalid response format from AI");
      }
    } catch (error) {
      console.error("Error:", error);
      removeTyping();
      addMessage("Sorry, I encountered an error. Please try again.", "ai");
    } finally {
      isProcessing = false;
      updateSendButtonState();
    }
  }

  // Update theme icons
  function updateIcons(theme) {
    if (theme === "dark") {
      sunIcon.style.display = "block";
      moonIcon.style.display = "none";
    } else {
      sunIcon.style.display = "none";
      moonIcon.style.display = "block";
    }
  }

  // Initialize
  updateSendButtonState();
  editor.focus();
});

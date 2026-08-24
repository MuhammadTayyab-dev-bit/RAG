// =====================================================
// FASTAPI ASSISTANT - FRONTEND SCRIPT
// =====================================================


// =====================================================
// DOM ELEMENTS
// =====================================================

const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");

const welcome = document.getElementById("welcome");
const suggestions = document.getElementById("suggestions");

const newChatBtn = document.getElementById("newChatBtn");
const chatHistory = document.getElementById("chatHistory");

const themeBtn = document.getElementById("themeBtn");


// =====================================================
// APPLICATION STATE
// =====================================================

let conversations =
    JSON.parse(localStorage.getItem("fastapiChats")) || [];

let currentConversation = null;


// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener("DOMContentLoaded", function () {

    initializeTheme();

    renderChatHistory();

    setupEventListeners();

});


// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {


    // ---------------------------------------------
    // SEND BUTTON
    // ---------------------------------------------

    if (sendBtn) {

        sendBtn.addEventListener("click", function () {

            sendMessage();

        });

    }


    // ---------------------------------------------
    // ENTER TO SEND
    // ---------------------------------------------

    if (messageInput) {

        messageInput.addEventListener("keydown", function (event) {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();

            }

        });


        // Auto resize
        messageInput.addEventListener("input", function () {

            this.style.height = "auto";

            this.style.height =
                Math.min(this.scrollHeight, 120) + "px";

        });

    }


    // ---------------------------------------------
    // NEW CHAT
    // ---------------------------------------------

    if (newChatBtn) {

        newChatBtn.addEventListener("click", function () {

            startNewChat();

        });

    }


    // ---------------------------------------------
    // THEME
    // ---------------------------------------------

    if (themeBtn) {

        themeBtn.addEventListener("click", function () {

            toggleTheme();

        });

    }


    // ---------------------------------------------
    // SUGGESTIONS
    // ---------------------------------------------

    document
        .querySelectorAll(".suggestion-card")
        .forEach(function (card) {

            card.addEventListener("click", function () {

                const title =
                    card.querySelector("h3");

                if (!title) {
                    return;
                }

                sendMessage(
                    title.textContent.trim()
                );

            });

        });


    // ---------------------------------------------
    // COPY BUTTON
    // ---------------------------------------------

    document.addEventListener("click", function (event) {

        const button =
            event.target.closest(".copy-btn");

        if (!button) {
            return;
        }

        copyCode(button);

    });

}


// =====================================================
// SEND MESSAGE
// =====================================================

async function sendMessage(question = null) {

    if (!messageInput) {
        return;
    }


    const text =
        question !== null
            ? question.trim()
            : messageInput.value.trim();


    if (!text) {
        return;
    }


    // ---------------------------------------------
    // CREATE CHAT ON FIRST MESSAGE
    // ---------------------------------------------

    if (!currentConversation) {

        createConversation(text);

    }


    // ---------------------------------------------
    // HIDE WELCOME
    // ---------------------------------------------

    if (welcome) {
        welcome.style.display = "none";
    }

    if (suggestions) {
        suggestions.style.display = "none";
    }


    // ---------------------------------------------
    // ADD USER MESSAGE
    // ---------------------------------------------

    addUserMessage(text);


    // ---------------------------------------------
    // CLEAR INPUT
    // ---------------------------------------------

    messageInput.value = "";

    messageInput.style.height = "auto";


    // ---------------------------------------------
    // DISABLE SEND
    // ---------------------------------------------

    if (sendBtn) {
        sendBtn.disabled = true;
    }


    // ---------------------------------------------
    // SHOW TYPING
    // ---------------------------------------------

    const typingMessage =
        addTypingIndicator();


    try {

        console.log("Sending request to FastAPI...");


        // -----------------------------------------
        // API REQUEST
        // -----------------------------------------

        const response =
            await fetch("https://rag-production-35c3.up.railway.app/chat", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    question: text
                })

            });


        console.log(
            "FastAPI status:",
            response.status
        );


        // -----------------------------------------
        // READ RESPONSE
        // -----------------------------------------

        const rawResponse =
            await response.text();


        console.log(
            "FastAPI response:",
            rawResponse
        );


        // -----------------------------------------
        // HTTP ERROR
        // -----------------------------------------

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}: ${rawResponse}`
            );

        }


        // -----------------------------------------
        // PARSE JSON
        // -----------------------------------------

        let data;

        try {

            data = JSON.parse(rawResponse);

        }

        catch (error) {

            throw new Error(
                "FastAPI returned invalid JSON."
            );

        }


        // -----------------------------------------
        // VALIDATE RESPONSE
        // -----------------------------------------

        if (
            !data ||
            typeof data.answer !== "string"
        ) {

            throw new Error(
                "Invalid backend response. Missing 'answer'."
            );

        }


        // -----------------------------------------
        // REMOVE TYPING
        // -----------------------------------------

        if (typingMessage) {
            typingMessage.remove();
        }


        // -----------------------------------------
        // ADD AI RESPONSE
        // -----------------------------------------

        addAssistantMessage(
            data.answer
        );


    }

    catch (error) {

        console.error(
            "FastAPI Error:",
            error
        );


        if (typingMessage) {
            typingMessage.remove();
        }


        addErrorMessage(
            error.message
        );

    }


    finally {

        if (sendBtn) {
            sendBtn.disabled = false;
        }

        messageInput.focus();

    }

}


// =====================================================
// CREATE CONVERSATION
// =====================================================

function createConversation(question) {

    const conversation = {

        id: Date.now(),

        title: createChatTitle(question),

        messages: [],

        createdAt: new Date().toISOString()

    };


    conversations.unshift(
        conversation
    );


    currentConversation =
        conversation;


    saveConversations();

    renderChatHistory();

}


// =====================================================
// CHAT TITLE
// =====================================================

function createChatTitle(question) {

    const clean =
        question
            .replace(/\s+/g, " ")
            .trim();


    if (clean.length <= 35) {
        return clean;
    }


    return clean.substring(0, 35) + "...";

}


// =====================================================
// SAVE CONVERSATIONS
// =====================================================

function saveConversations() {

    localStorage.setItem(
        "fastapiChats",
        JSON.stringify(conversations)
    );

}


// =====================================================
// RENDER CHAT HISTORY
// =====================================================

function renderChatHistory() {

    if (!chatHistory) {

        console.warn(
            "chatHistory element not found."
        );

        return;

    }


    chatHistory.innerHTML = "";


    // ---------------------------------------------
    // EMPTY STATE
    // ---------------------------------------------

    if (conversations.length === 0) {

        return;

    }


    // ---------------------------------------------
    // HISTORY ITEMS
    // ---------------------------------------------

    conversations.forEach(function (conversation) {

        const item =
            document.createElement("button");


        item.type = "button";

        item.className = "history-item";


        // Active chat
        if (
            currentConversation &&
            currentConversation.id === conversation.id
        ) {

            item.classList.add("active");

        }


        item.innerHTML = `

            <i class="fa-regular fa-message"></i>

            <span>
                ${escapeHTML(conversation.title)}
            </span>

        `;


        // Click history item
        item.addEventListener("click", function () {

            loadConversation(
                conversation.id
            );

        });


        chatHistory.appendChild(item);

    });

}


// =====================================================
// LOAD CONVERSATION
// =====================================================

function loadConversation(id) {

    const conversation =
        conversations.find(function (chat) {

            return chat.id === id;

        });


    if (!conversation) {
        return;
    }


    currentConversation =
        conversation;


    // ---------------------------------------------
    // CLEAR CURRENT SCREEN
    // ---------------------------------------------

    messages.innerHTML = "";


    // ---------------------------------------------
    // HIDE WELCOME
    // ---------------------------------------------

    if (welcome) {
        welcome.style.display = "none";
    }

    if (suggestions) {
        suggestions.style.display = "none";
    }


    // ---------------------------------------------
    // RESTORE MESSAGES
    // ---------------------------------------------

    conversation.messages.forEach(function (message) {

        if (message.role === "user") {

            renderUserMessage(
                message.content
            );

        }

        else if (message.role === "assistant") {

            renderAssistantMessage(
                message.content
            );

        }

    });


    renderChatHistory();

    scrollToBottom();

}


// =====================================================
// START NEW CHAT
// =====================================================

function startNewChat() {

    currentConversation = null;


    // Clear messages
    messages.innerHTML = "";


    // Show welcome
    if (welcome) {
        welcome.style.display = "block";
    }


    // Show suggestions
    if (suggestions) {
        suggestions.style.display = "grid";
    }


    // Clear input
    if (messageInput) {

        messageInput.value = "";

        messageInput.style.height = "auto";

        messageInput.focus();

    }


    renderChatHistory();

}


// =====================================================
// ADD USER MESSAGE
// =====================================================

function addUserMessage(text) {

    renderUserMessage(text);


    if (!currentConversation) {
        return;
    }


    currentConversation.messages.push({

        role: "user",

        content: text

    });


    saveConversations();

}


// =====================================================
// RENDER USER MESSAGE
// =====================================================

function renderUserMessage(text) {

    const message =
        document.createElement("div");


    message.className =
        "message user-message";


    message.innerHTML = `

        <div class="message-content">

            <p>
                ${escapeHTML(text)}
            </p>

            <div class="message-meta">

                Just now

                <i class="fa-solid fa-check-double"></i>

            </div>

        </div>

    `;


    messages.appendChild(message);

    scrollToBottom();

}


// =====================================================
// ADD ASSISTANT MESSAGE
// =====================================================

function addAssistantMessage(text) {

    renderAssistantMessage(text);


    if (!currentConversation) {
        return;
    }


    currentConversation.messages.push({

        role: "assistant",

        content: text

    });


    saveConversations();


    // Update history
    renderChatHistory();

}


// =====================================================
// RENDER ASSISTANT MESSAGE
// =====================================================

function renderAssistantMessage(text) {

    const message =
        document.createElement("div");


    message.className =
        "message assistant-message";


    message.innerHTML = `

        <div class="assistant-avatar">

            <i class="fa-solid fa-bolt"></i>

        </div>

        <div class="assistant-content">

            <div class="answer-text">

                ${formatAnswer(text)}

            </div>

            <div class="message-meta">

                Just now

            </div>

        </div>

    `;


    messages.appendChild(message);

    scrollToBottom();

}


// =====================================================
// TYPING INDICATOR
// =====================================================

function addTypingIndicator() {

    const message =
        document.createElement("div");


    message.className =
        "message assistant-message typing-message";


    message.innerHTML = `

        <div class="assistant-avatar">

            <i class="fa-solid fa-bolt"></i>

        </div>

        <div class="assistant-content">

            <div class="typing">

                <span></span>
                <span></span>
                <span></span>

            </div>

        </div>

    `;


    messages.appendChild(message);

    scrollToBottom();


    return message;

}


// =====================================================
// ERROR MESSAGE
// =====================================================

function addErrorMessage(errorText) {

    const message =
        document.createElement("div");


    message.className =
        "message assistant-message";


    message.innerHTML = `

        <div class="assistant-avatar">

            <i class="fa-solid fa-triangle-exclamation"></i>

        </div>

        <div class="assistant-content">

            <p>
                <strong>
                    Something went wrong
                </strong>
            </p>

            <pre class="error-details">
${escapeHTML(errorText)}
            </pre>

        </div>

    `;


    messages.appendChild(message);

    scrollToBottom();

}


// =====================================================
// FORMAT AI ANSWER
// =====================================================

function formatAnswer(text) {

    if (!text) {

        return "I couldn't generate an answer.";

    }


    let formatted =
        escapeHTML(text);


    // ---------------------------------------------
    // CODE BLOCKS
    // ---------------------------------------------

    formatted =
        formatted.replace(
            /```(?:python|javascript|js|json|bash|html|css)?\s*([\s\S]*?)```/gi,

            function (match, code) {

                return `

                    <div class="code-block">

                        <div class="code-header">

                            <span>Code</span>

                            <button
                                class="copy-btn"
                                type="button">

                                <i class="fa-regular fa-copy"></i>

                                Copy

                            </button>

                        </div>

                        <pre><code>${code.trim()}</code></pre>

                    </div>

                `;

            }
        );


    // ---------------------------------------------
    // BOLD
    // ---------------------------------------------

    formatted =
        formatted.replace(
            /\*\*(.*?)\*\*/g,
            "<strong>$1</strong>"
        );


    // ---------------------------------------------
    // INLINE CODE
    // ---------------------------------------------

    formatted =
        formatted.replace(
            /`([^`]+)`/g,
            "<code>$1</code>"
        );


    // ---------------------------------------------
    // NEWLINES
    // ---------------------------------------------

    formatted =
        formatted.replace(
            /\n/g,
            "<br>"
        );


    return formatted;

}


// =====================================================
// COPY CODE
// =====================================================

async function copyCode(button) {

    const codeBlock =
        button.closest(".code-block");


    if (!codeBlock) {
        return;
    }


    const code =
        codeBlock
            .querySelector("code")
            .innerText;


    try {

        await navigator.clipboard.writeText(code);


        button.innerHTML =
            '<i class="fa-solid fa-check"></i> Copied';


        setTimeout(function () {

            button.innerHTML =
                '<i class="fa-regular fa-copy"></i> Copy';

        }, 1500);

    }

    catch (error) {

        console.error(
            "Copy failed:",
            error
        );

    }

}


// =====================================================
// THEME
// =====================================================

function initializeTheme() {

    if (!themeBtn) {
        return;
    }


    const savedTheme =
        localStorage.getItem("fastapiTheme");


    if (savedTheme === "light") {

        document.body.classList.add(
            "light-theme"
        );


        themeBtn.innerHTML =
            '<i class="fa-regular fa-sun"></i>';

    }

    else {

        document.body.classList.remove(
            "light-theme"
        );


        themeBtn.innerHTML =
            '<i class="fa-regular fa-moon"></i>';

    }

}


// =====================================================
// TOGGLE THEME
// =====================================================

function toggleTheme() {

    if (!themeBtn) {
        return;
    }


    const isLight =
        document.body.classList.toggle(
            "light-theme"
        );


    if (isLight) {

        themeBtn.innerHTML =
            '<i class="fa-regular fa-sun"></i>';


        localStorage.setItem(
            "fastapiTheme",
            "light"
        );

    }

    else {

        themeBtn.innerHTML =
            '<i class="fa-regular fa-moon"></i>';


        localStorage.setItem(
            "fastapiTheme",
            "dark"
        );

    }

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(text) {

    const div =
        document.createElement("div");


    div.textContent =
        String(text);


    return div.innerHTML;

}


// =====================================================
// SCROLL
// =====================================================

function scrollToBottom() {

    setTimeout(function () {

        const chatArea =
            document.querySelector(".chat-area");


        if (!chatArea) {
            return;
        }


        chatArea.scrollTo({

            top: chatArea.scrollHeight,

            behavior: "smooth"

        });

    }, 50);

}
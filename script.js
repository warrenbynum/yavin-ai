// Mobile Menu
const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');
const mobileNavLinks = document.querySelectorAll('.mobile-nav-list a');

// Create overlay
const overlay = document.createElement('div');
overlay.className = 'mobile-menu-overlay';
document.body.appendChild(overlay);

function toggleMobileMenu() {
    const isActive = mobileMenu.classList.toggle('active');
    mobileMenuToggle.classList.toggle('active');
    overlay.classList.toggle('active');
    mobileMenuToggle.setAttribute('aria-expanded', isActive);
    document.body.style.overflow = isActive ? 'hidden' : '';
}

function closeMobileMenu() {
    mobileMenuToggle.classList.remove('active');
    mobileMenu.classList.remove('active');
    overlay.classList.remove('active');
    mobileMenuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
}

mobileMenuToggle.addEventListener('click', toggleMobileMenu);
overlay.addEventListener('click', closeMobileMenu);

mobileNavLinks.forEach(link => {
    link.addEventListener('click', closeMobileMenu);
});

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const navHeight = document.querySelector('.navbar').offsetHeight;
            window.scrollTo({
                top: target.offsetTop - navHeight - 20,
                behavior: 'smooth'
            });
        }
    });
});

// Navbar scroll effect
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
    navbar.style.background = window.pageYOffset > 50 ? 'rgba(0, 0, 0, 0.95)' : 'rgba(0, 0, 0, 0.8)';
});

// Active section highlighting (for TOC)
const sections = document.querySelectorAll('.section');

// Close mobile menu on resize
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeMobileMenu();
});

// Progress Bar
const progressBar = document.querySelector('.progress-bar');

function updateProgressBar() {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight - windowHeight;
    const scrolled = window.pageYOffset;
    const progress = (scrolled / documentHeight) * 100;
    progressBar.style.width = `${progress}%`;
}

window.addEventListener('scroll', updateProgressBar);
window.addEventListener('resize', updateProgressBar);

// Table of Contents
const tocSidebar = document.querySelector('.toc-sidebar');
const tocLinks = document.querySelectorAll('.toc-link');
const heroSection = document.querySelector('.hero');

function updateTOC() {
    // Show TOC after hero section
    const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
    const scrollPos = window.pageYOffset;
    
    if (scrollPos > heroBottom - 200) {
        tocSidebar.classList.add('visible');
    } else {
        tocSidebar.classList.remove('visible');
    }
    
    // Update active link
    const scrollPosWithOffset = scrollPos + 300;
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionBottom = sectionTop + section.offsetHeight;
        const sectionId = section.getAttribute('id');
        
        if (scrollPosWithOffset >= sectionTop && scrollPosWithOffset < sectionBottom) {
            tocLinks.forEach(link => {
                if (link.getAttribute('data-section') === sectionId) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        }
    });
}

window.addEventListener('scroll', updateTOC);
window.addEventListener('resize', updateTOC);

// TOC link clicks
tocLinks.forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const target = document.querySelector(targetId);
        if (target) {
            const navHeight = navbar.offsetHeight;
            window.scrollTo({
                top: target.offsetTop - navHeight - 20,
                behavior: 'smooth'
            });
        }
    });
});

// High Contrast Toggle
const contrastToggle = document.getElementById('contrast-toggle');
const htmlElement = document.documentElement;

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme') || 'default';
htmlElement.setAttribute('data-theme', savedTheme);
if (savedTheme === 'high-contrast') {
    contrastToggle.classList.add('active');
    contrastToggle.setAttribute('aria-pressed', 'true');
} else {
    contrastToggle.setAttribute('aria-pressed', 'false');
}

contrastToggle.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'default' ? 'high-contrast' : 'default';
    
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    contrastToggle.classList.toggle('active');
    const isActive = contrastToggle.classList.contains('active');
    contrastToggle.setAttribute('aria-pressed', isActive);
});

// Text-to-Speech (TTS)
const ttsToggle = document.getElementById('tts-toggle');
let ttsActive = false;
let currentUtterance = null;

// Check for Web Speech API support
const speechSupported = 'speechSynthesis' in window;
if (!speechSupported) {
    ttsToggle.disabled = true;
    ttsToggle.style.opacity = '0.5';
    ttsToggle.title = 'Text-to-Speech not supported in this browser';
}

ttsToggle.setAttribute('aria-pressed', 'false');

function stopSpeech() {
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    ttsActive = false;
    ttsToggle.classList.remove('active');
    ttsToggle.setAttribute('aria-pressed', 'false');
}

function startSpeech() {
    stopSpeech();
    
    // Get all text content from sections
    const contentBlocks = document.querySelectorAll('.section .content-block');
    let textToRead = '';
    
    contentBlocks.forEach(block => {
        const text = block.innerText || block.textContent;
        textToRead += text + '. ';
    });
    
    if (textToRead.trim()) {
        currentUtterance = new SpeechSynthesisUtterance(textToRead);
        currentUtterance.rate = 1.0;
        currentUtterance.pitch = 1.0;
        currentUtterance.volume = 1.0;
        
        currentUtterance.onend = () => {
            stopSpeech();
        };
        
        currentUtterance.onerror = () => {
            stopSpeech();
            alert('Text-to-Speech error occurred. Please try again.');
        };
        
        window.speechSynthesis.speak(currentUtterance);
        ttsActive = true;
        ttsToggle.classList.add('active');
        ttsToggle.setAttribute('aria-pressed', 'true');
    }
}

ttsToggle.addEventListener('click', () => {
    if (!speechSupported) return;
    
    if (ttsActive) {
        stopSpeech();
    } else {
        startSpeech();
    }
});

// Stop speech when navigating away
window.addEventListener('beforeunload', stopSpeech);

// Read specific section on TOC click
tocLinks.forEach(link => {
    link.addEventListener('dblclick', (e) => {
        if (!speechSupported) return;
        
        e.preventDefault();
        const sectionId = link.getAttribute('data-section');
        const section = document.getElementById(sectionId);
        
        if (section) {
            stopSpeech();
            
            const contentBlocks = section.querySelectorAll('.content-block');
            let textToRead = section.querySelector('.section-title').textContent + '. ';
            
            contentBlocks.forEach(block => {
                const text = block.innerText || block.textContent;
                textToRead += text + '. ';
            });
            
            currentUtterance = new SpeechSynthesisUtterance(textToRead);
            currentUtterance.rate = 1.0;
            currentUtterance.pitch = 1.0;
            currentUtterance.volume = 1.0;
            
            currentUtterance.onend = () => {
                stopSpeech();
            };
            
            window.speechSynthesis.speak(currentUtterance);
            ttsActive = true;
            ttsToggle.classList.add('active');
            ttsToggle.setAttribute('aria-pressed', 'true');
        }
    });
});

// Quiz Functionality
function submitQuiz(section) {
    const quizContainer = document.querySelector(`.quiz-container[data-section="${section}"]`);
    const questions = quizContainer.querySelectorAll('.quiz-question');
    const submitButton = quizContainer.querySelector('.quiz-submit');
    const resultsDiv = quizContainer.querySelector('.quiz-results');
    
    let totalQuestions = questions.length;
    let correctAnswers = 0;
    let answeredAll = true;
    
    // Check each question
    questions.forEach((question, index) => {
        const questionNum = index + 1;
        const options = question.querySelectorAll('.quiz-option');
        const selectedInput = question.querySelector('input[type="radio"]:checked');
        
        if (!selectedInput) {
            answeredAll = false;
            return;
        }
        
        // Find the correct option
        options.forEach(option => {
            const input = option.querySelector('input[type="radio"]');
            const isCorrect = input.hasAttribute('data-correct');
            const isSelected = input.checked;
            
            // Remove previous styling
            option.classList.remove('correct', 'incorrect');
            
            // Apply new styling
            if (isCorrect) {
                option.classList.add('correct');
                if (isSelected) {
                    correctAnswers++;
                }
            } else if (isSelected && !isCorrect) {
                option.classList.add('incorrect');
            }
            
            // Disable all inputs
            input.disabled = true;
            option.style.cursor = 'default';
        });
    });
    
    if (!answeredAll) {
        alert('Please answer all questions before submitting.');
        return;
    }
    
    // Calculate score percentage
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    
    // Determine message based on score
    let message = '';
    let emoji = '';
    if (percentage === 100) {
        message = 'Perfect! You have a complete understanding of this topic.';
        emoji = '🎉';
    } else if (percentage >= 80) {
        message = 'Great job! You have a strong grasp of the material.';
        emoji = '✨';
    } else if (percentage >= 60) {
        message = 'Good effort! Consider reviewing the material to strengthen your understanding.';
        emoji = '👍';
    } else {
        message = 'Keep learning! Review the section and try again.';
        emoji = '📚';
    }
    
    // Display results
    resultsDiv.innerHTML = `
        <h4>Quiz Results ${emoji}</h4>
        <div class="quiz-score">${correctAnswers} / ${totalQuestions}</div>
        <p><strong>Score: ${percentage}%</strong></p>
        <p>${message}</p>
    `;
    resultsDiv.style.display = 'block';
    
    // Disable submit button
    submitButton.disabled = true;
    submitButton.textContent = 'Quiz Completed';
    
    // Scroll to results
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Feedback Modal Functions
function openFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal when clicking outside
document.getElementById('feedbackModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeFeedbackModal();
    }
});

// Handle feedback form submission
document.getElementById('feedbackForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const data = {
        name: formData.get('name') || 'Anonymous',
        email: formData.get('email') || 'Not provided',
        rating: formData.get('rating'),
        message: formData.get('message')
    };
    
    // Log to console (in real implementation, send to server/Google Forms)
    console.log('Feedback submitted:', data);
    
    // Show success message
    document.querySelector('.feedback-form').style.display = 'none';
    document.getElementById('feedbackSuccess').style.display = 'block';
    
    // Reset form and close after 3 seconds
    setTimeout(() => {
        this.reset();
        document.querySelector('.feedback-form').style.display = 'flex';
        document.getElementById('feedbackSuccess').style.display = 'none';
        closeFeedbackModal();
    }, 3000);
});

// Escape key to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeFeedbackModal();
    }
});

// Search Functionality
const searchToggle = document.getElementById('searchToggle');
const searchDropdown = document.getElementById('searchDropdown');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

// Create search overlay
const searchOverlay = document.createElement('div');
searchOverlay.className = 'search-overlay';
document.body.appendChild(searchOverlay);

// Build searchable content from all sections
const searchableContent = [];

document.querySelectorAll('.section').forEach(section => {
    const sectionId = section.getAttribute('id');
    const sectionTitle = section.querySelector('.section-title')?.textContent || '';
    
    // Get all content blocks
    section.querySelectorAll('.content-block').forEach(block => {
        const headings = block.querySelectorAll('h3, h4');
        const paragraphs = block.querySelectorAll('p');
        
        headings.forEach(heading => {
            const content = heading.textContent.trim();
            if (content) {
                searchableContent.push({
                    title: content,
                    content: content,
                    section: sectionTitle,
                    sectionId: sectionId,
                    element: heading
                });
            }
        });
        
        paragraphs.forEach(para => {
            const content = para.textContent.trim();
            if (content && content.length > 50) {
                searchableContent.push({
                    title: content.substring(0, 80) + (content.length > 80 ? '...' : ''),
                    content: content,
                    section: sectionTitle,
                    sectionId: sectionId,
                    element: para
                });
            }
        });
    });
});

// Initialize Fuse.js
const fuseOptions = {
    keys: ['title', 'content', 'section'],
    threshold: 0.3,
    includeScore: true,
    minMatchCharLength: 2
};

const fuse = new Fuse(searchableContent, fuseOptions);

// Toggle search dropdown
searchToggle.addEventListener('click', () => {
    searchDropdown.classList.toggle('active');
    searchToggle.classList.toggle('active');
    searchOverlay.classList.toggle('active');
    
    if (searchDropdown.classList.contains('active')) {
        searchInput.focus();
        document.body.style.overflow = 'hidden';
    } else {
        searchInput.value = '';
        searchResults.innerHTML = '';
        document.body.style.overflow = '';
    }
});

// Search functionality
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    
    searchTimeout = setTimeout(() => {
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            searchResults.innerHTML = '';
            return;
        }
        
        const results = fuse.search(query);
        
        if (results.length === 0) {
            searchResults.innerHTML = `
                <div class="search-no-results">
                    No results found for "${query}"
                </div>
            `;
            return;
        }
        
        // Display top 8 results
        const topResults = results.slice(0, 8);
        searchResults.innerHTML = topResults.map(result => {
            const item = result.item;
            const excerpt = item.content.substring(0, 120) + (item.content.length > 120 ? '...' : '');
            
            return `
                <div class="search-result-item" data-section-id="${item.sectionId}">
                    <div class="search-result-title">${item.title}</div>
                    <div class="search-result-excerpt">${excerpt}</div>
                    <div class="search-result-section">${item.section}</div>
                </div>
            `;
        }).join('');
        
        // Add click handlers to results
        document.querySelectorAll('.search-result-item').forEach(resultItem => {
            resultItem.addEventListener('click', () => {
                const sectionId = resultItem.getAttribute('data-section-id');
                const section = document.getElementById(sectionId);
                
                if (section) {
                    const navHeight = navbar.offsetHeight;
                    window.scrollTo({
                        top: section.offsetTop - navHeight - 20,
                        behavior: 'smooth'
                    });
                    
                    // Close search
                    searchDropdown.classList.remove('active');
                    searchToggle.classList.remove('active');
                    searchOverlay.classList.remove('active');
                    searchInput.value = '';
                    searchResults.innerHTML = '';
                    document.body.style.overflow = '';
                }
            });
        });
    }, 300);
});

// Close search when clicking outside or on overlay
document.addEventListener('click', (e) => {
    if (!searchToggle.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.remove('active');
        searchToggle.classList.remove('active');
        searchOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
});

searchOverlay.addEventListener('click', () => {
    searchDropdown.classList.remove('active');
    searchToggle.classList.remove('active');
    searchOverlay.classList.remove('active');
    searchInput.value = '';
    searchResults.innerHTML = '';
    document.body.style.overflow = '';
});

// Close search with ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && searchDropdown.classList.contains('active')) {
        searchDropdown.classList.remove('active');
        searchToggle.classList.remove('active');
        searchOverlay.classList.remove('active');
        searchInput.value = '';
        searchResults.innerHTML = '';
        document.body.style.overflow = '';
    }
});

// Mobile TOC Functionality
const mobileTocButton = document.getElementById('mobileTocButton');
const mobileTocModal = document.getElementById('mobileTocModal');
const mobileTocItems = document.querySelectorAll('.mobile-toc-item');

function openMobileToc() {
    mobileTocModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileToc() {
    mobileTocModal.classList.remove('active');
    document.body.style.overflow = '';
}

if (mobileTocButton) {
    mobileTocButton.addEventListener('click', openMobileToc);
}

// Close mobile TOC when clicking outside
mobileTocModal.addEventListener('click', (e) => {
    if (e.target === mobileTocModal) {
        closeMobileToc();
    }
});

// Mobile TOC navigation
mobileTocItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = item.getAttribute('href');
        const target = document.querySelector(targetId);
        
        if (target) {
            const navHeight = navbar.offsetHeight;
            window.scrollTo({
                top: target.offsetTop - navHeight - 20,
                behavior: 'smooth'
            });
            closeMobileToc();
        }
    });
});

// Show/hide mobile TOC button based on scroll
let lastScrollY = window.pageYOffset;

window.addEventListener('scroll', () => {
    const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
    const currentScrollY = window.pageYOffset;
    
    // Show button after hero section
    if (currentScrollY > heroBottom - 200) {
        if (mobileTocButton) {
            mobileTocButton.style.opacity = '1';
            mobileTocButton.style.pointerEvents = 'auto';
        }
    } else {
        if (mobileTocButton) {
            mobileTocButton.style.opacity = '0';
            mobileTocButton.style.pointerEvents = 'none';
        }
    }
    
    lastScrollY = currentScrollY;
});

console.log('Yavin – Understanding AI');


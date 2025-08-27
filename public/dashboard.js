/*
<!----------------------------------------------------------
Name: Saisaurav Samanta
Class: 9-B
School: The Newtown School, Kolkata
Version: 1.0
------------------------------------------------------------>
*/
const socket = io();
function showSection(sectionId) {
  document.querySelectorAll(".section").forEach(sec => sec.classList.add("hidden"));
  document.getElementById(sectionId + "-section").classList.remove("hidden");
}

function showLoading() {
  document.getElementById("loading-animation").classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("loading-animation").classList.add("hidden");
}
let currentMaterial = null; // Store the processed material
let currentStudentQuizData = null; // Store the quiz data for the student to attempt

// Process material (adds as chat bubble)
async function submitMaterial(e) {
  e.preventDefault();

  const form = document.getElementById("material-form");
  const formData = new FormData(form);

  showLoading(); // Show loading animation

  try {
    // Call backend
    const response = await fetch("/process-material", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    console.log("AI Result:", data);

    const outputBox = document.getElementById("material-output");
    outputBox.innerHTML = ""; // clear old results

    currentMaterial = data; // Store the processed material
    const chartsBox = document.getElementById("notes-box");
    chartsBox.innerHTML = ""; // clear old charts

    if (data.title) {
      outputBox.innerHTML += `
        <div class="message" style="height: 2rem; font-weight: bold; font-size: 1.8rem; text-align: center"> ${data.title}</div>
      `;
    }

    // Render study material
    if (data.studyMaterial) {
      outputBox.innerHTML += `
        <div class="message"><strong>📖 Overview:</strong> ${data.studyMaterial}</div>
      `;
    }

    // Render bullet points
    if (data.bulletPoints && data.bulletPoints.length) {
      outputBox.innerHTML += `
        <div class="message"><strong>🔹 Key Points:</strong>
          <ul>${data.bulletPoints.map(p => `<li>${p}</li>`).join("")}</ul>
        </div>
      `;
    }

    // Render charts (placeholder containers)
    if (data.charts && data.charts.length) {
      data.charts.forEach((chart, idx) => {
        const canvasId = `chart-${idx}`;
        chartsBox.innerHTML += `
          <div class="message">
            <strong>📊 ${chart.title}</strong>
            <canvas id="${canvasId}" width="400" height="200"></canvas>
          </div>
        `;

        // Draw chart with Chart.js
        setTimeout(() => {
          const ctx = document.getElementById(canvasId).getContext("2d");
          new Chart(ctx, {
            type: chart.type,
            data: {
              // FIX: Access chart.data.labels and chart.data.values directly
              labels: chart.data.labels,
              datasets: [{
                label: chart.title,
                data: chart.data.values,
                backgroundColor: "rgba(46, 125, 91, 0.6)"
              }]
            }
          });
        }, 100);
      });
    }

    // Render summary
    if (data.summary) {
      outputBox.innerHTML += `
        <div class="message"><strong>📖 Summary:</strong> ${data.summary}</div>
      `;
    }

  } catch (error) {
    console.error("Error processing material:", error);
    const outputBox = document.getElementById("material-output");
    outputBox.innerHTML = `<div class="message error-message">❌ Failed to process material. Please try again.</div>`;
  } finally {
    hideLoading(); // Hide loading animation regardless of success or failure
  }
}


// Quiz modal for teacher dashboard
function openTeacherQuizModal() { // Renamed to avoid conflict
  document.getElementById("quiz-modal").classList.remove("hidden");
}

function closeTeacherQuizModal() { // Renamed to avoid conflict
  document.getElementById("quiz-modal").classList.add("hidden");
}

let currentQuiz = null; // This seems to be for the teacher's generated quiz

async function submitQuizForm(e) {
  e.preventDefault();
  closeTeacherQuizModal(); // Use the renamed function
  showLoading();

  const form = document.getElementById("quiz-form");
  const formData = new FormData();

  const quizData = document.getElementById("material-output").innerText;
  formData.append("quizData", quizData);

  const numQuestions = form.querySelector('input[type="number"]').value;
  formData.append("numQuestions", numQuestions);

  document.querySelectorAll('input[name="quizType"]:checked').forEach(checkbox => {
    formData.append("quizType", checkbox.value);
  });

  try {
    const response = await fetch("/generate-quiz", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    currentQuiz = data; // Store the generated quiz
    console.log("Generated Quiz:", data);

    if (response.status !== 200) {
      console.error("Server Error:", data.error);
      const quizContainer = document.getElementById("quiz-output");
      quizContainer.innerHTML = `<div class="quiz-error">Error: ${data.error}</div>`;
      return;
    }

    // Display quiz questions on teacher dashboard (already existing logic)
    const quizContainer = document.getElementById("quiz-output");
    const quizAnswersContainer = document.getElementById("quiz-answers");
    quizContainer.innerHTML = ""; // Clear old quiz
    quizAnswersContainer.innerHTML = ""; // Clear old answers

    data.questions.forEach((question, idx) => {
        if (question.type === "multipleChoice") {
          quizContainer.innerHTML += `
            <div class="quiz-question">
              <strong>Q${idx + 1} (${question.type}): ${question.question}</strong>
              <ol type="A">
                ${question.options.map(option => `<li>${option}</li>`).join("")}
              </ol>
            </div>
          `;
        } else {
          quizContainer.innerHTML += `
            <div class="quiz-question">
              <strong>Q${idx + 1} (${question.type}): ${question.question}</strong>
            </div>
            <br>
          `;
        }
        // Always show the answer
        quizAnswersContainer.innerHTML += `
          <div class="quiz-answer">
            <strong>Answer ${idx + 1}:</strong> ${question.answer}
          </div>
        `;
    });

  } catch (error) {
    console.error("Error generating quiz:", error);
    const quizContainer = document.getElementById("quiz-output");
    quizContainer.innerHTML = `<div class="quiz-error">An unexpected error occurred.</div>`;
  } finally {
    hideLoading();
  }
}

// Toggle doubts pane
function toggleDoubts() {
  const pane = document.getElementById("doubts-pane");
  pane.classList.toggle("open");
}

// Logout
function logout() {
  // Replaced alert with custom modal or message box
  displayMessage("Logged out!", "info");
  window.location.href = "login.html";
}

function hideMaterials() {
  document.getElementById("material-form").classList.toggle("hidden");
  document.getElementById("showButton").classList.toggle("hidden");
}

async function startClass() {
  const response = await fetch("/start-class", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      material: currentMaterial,  // ← the parsed AI material shown on teacher dashboard
      quiz: currentQuiz           // ← the quiz teacher prepared
    })
  });

  const data = await response.json();
  if (data.success) {
    // Replaced alert with custom modal or message box
    window.alert(`Class started! Share this ID with students: ${data.classId}`);
    document.getElementById("class-id").innerHTML = data.classId;
  } else {
    window.alert("Failed to start class. Please try again.");
  }
  setupTeacherCaptioning(document.getElementById("class-id").innerHTML);
}

// MODIFIED joinClass function for student dashboard
async function joinClass() {
  document.getElementsByClassName("join-dropdown")[0].classList.remove("open");
  const classId = document.getElementById("class-id-input").value.trim();
  if (!classId) {
    // Replaced alert with custom modal or message box as per instructions
    displayMessage("Please enter a Class ID.", "warning");
    return;
  }

  try {
    const response = await fetch(`/join-class/${classId}`);
    if (!response.ok) {
      // Replaced alert with custom modal or message box
      displayMessage("Class not found. Please check the ID.", "error");
      throw new Error("Class not found");
    }

    const data = await response.json();
    console.log("✅ Class joined:", data);

    const container = document.getElementById("material-output");
    container.innerHTML = ""; // Clear old content

    if (!data.material) {
      container.innerHTML = `<div class="message">⚠️ No material available for this class</div>`;
      return;
    }

    // --- Parse material safely ---
    let material = data.material;
    if (typeof material === "string") {
      try {
        material = JSON.parse(material);
      } catch (err) {
        console.warn("⚠️ Material not valid JSON, falling back to raw:", err.message);
        container.innerHTML = `<div class="message">${data.material}</div>`;
        return;
      }
    }

    // --- Render structured material ---
    if (material.title) {
      const titleBlock = document.createElement("div");
      titleBlock.className = "message";
      titleBlock.innerHTML = `<h2 style="color: #7d792e; text-align: center">${material.title}</h2>`;
      container.appendChild(titleBlock);
    }

    if (material.studyMaterial) {
      const studyBlock = document.createElement("div");
      studyBlock.className = "message";
      studyBlock.innerHTML = `<h3>OverView</h3><p>${material.studyMaterial}</p>`;
      container.appendChild(studyBlock);
    }

    if (Array.isArray(material.bulletPoints) && material.bulletPoints.length > 0) {
      const pointsBlock = document.createElement("div");
      pointsBlock.className = "message";
      pointsBlock.innerHTML =
        `<h3>Key Points</h3><ul>${material.bulletPoints.map(p => `<li>${p}</li>`).join("")}</ul>`;
      container.appendChild(pointsBlock);
    }

    if (material.summary) {
      const summaryBlock = document.createElement("div");
      summaryBlock.className = "message";
      summaryBlock.innerHTML = `<h3>Summary</h3><p>${material.summary}</p>`;
      container.appendChild(summaryBlock);
    }

    if (Array.isArray(material.charts) && material.charts.length > 0) {
      material.charts.forEach((chart, idx) => {
        const chartBlock = document.createElement("div");
        chartBlock.className = "message";
        chartBlock.innerHTML = `<h3>${chart.title}</h3><canvas id="chart-${idx}"></canvas>`;
        document.getElementsByClassName("notes-box")[0].appendChild(chartBlock);

        new Chart(document.getElementById(`chart-${idx}`), {
          type: chart.type || "bar",
          data: {
            labels: chart.data.labels,
            datasets: [{
              label: chart.title,
              data: chart.data.values
            }]
          }
        });
      });
    }

    // --- Render quiz safely for student dashboard ---
    if (data.quiz) {
      let quiz = data.quiz;
      if (typeof quiz === "string") {
        try {
          quiz = JSON.parse(quiz);
        } catch (err) {
          console.warn("⚠️ Quiz not valid JSON:", err.message);
          quiz = { questions: [] }; // Ensure quiz.questions is an array
        }
      }

      if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
        // Store the quiz data globally for access by the modal
        currentStudentQuizData = quiz;

        const quizOutputDiv = document.getElementsByClassName("st-quiz")[0];
        quizOutputDiv.innerHTML = ""; // Clear existing content
        const quizOverview = document.createElement("div");
        quizOverview.className = "quiz-overview";
        quizOverview.innerHTML = `<h1 style="text-align: center; color: #605d24ff">Quiz</h1><h3 style="text-align: center">${material.title}</h3>
                                  <p style="text-align: center;">Click "Start Quiz" to begin your assessment.</p>`;
        quizOutputDiv.appendChild(quizOverview);

        const startQuizButton = document.createElement("button");
        startQuizButton.className = "startQuiz";
        startQuizButton.textContent = "Start Quiz";
        startQuizButton.onclick = () => {
          renderQuizInModal(currentStudentQuizData, material.title);
          openQuizModal();
        };
        document.getElementById("quiz-output").appendChild(startQuizButton);
        // Ensure the initial quiz display area is visible, if hidden previously for placeholder
        document.getElementsByClassName("st-quiz")[0].classList.remove("hidden");
      }
    } else {
        document.getElementById("quiz-output").innerHTML = `<div class="st-quiz"><p class="placeholder">No quiz available for this class.</p></div>`;
    }
    setupStudentCaptioning(classId);

  } catch (error) {
    console.error("❌ Failed to join class:", error);
    // Replaced alert with custom modal or message box
    displayMessage("Failed to join class. Try again.", "error");
  }
}


function handleJoinClass() {
  const classId = document.getElementById("class-id-input").value.trim();
  if (!classId) {
    displayMessage("Please enter a Class ID", "warning"); // Using custom message
    return;
  }
  joinClass(classId);
}


document.getElementsByClassName("join-dropdown-trigger")[0].addEventListener("click", () => {
  const dropdown = document.getElementsByClassName("join-dropdown")[0];
  dropdown.classList.toggle("open");
});

// New functions for the student quiz modal

function openQuizModal() {
  document.getElementById("quiz-modal").classList.remove("hidden");
}

function closeQuizModal() {
  document.getElementById("quiz-modal").classList.add("hidden");
  // Optional: Clear the form when closing the modal
  document.getElementById("student-quiz-form").innerHTML = '';
}

function renderQuizInModal(quizData, materialTitle) {
    const quizModalTitle = document.getElementById('quiz-modal-title');
    const quizForm = document.getElementById('student-quiz-form');
    quizForm.innerHTML = ''; // Clear previous questions

    quizModalTitle.textContent = `${materialTitle} Quiz`;

    quizData.questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'quiz-modal-question';
        questionDiv.innerHTML = `<p><strong>Q${index + 1}:</strong> ${question.question}</p>`;

        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'quiz-modal-options';

        if (question.type === "multipleChoice" && question.options) {
            question.options.forEach((option, optIndex) => {
                const optionId = `q${index}-opt${optIndex}`;
                optionsDiv.innerHTML += `
                    <input type="radio" id="${optionId}" name="question-${index}" value="${option}">
                    <label for="${optionId}">${option}</label><br>
                `;
            });
        } else if (question.type === "TrueFalse") {
            optionsDiv.innerHTML += `
                <input type="radio" id="q${index}-true" name="question-${index}" value="True">
                <label for="q${index}-true">True</label><br>
                <input type="radio" id="q${index}-false" name="question-${index}" value="False">
                <label for="q${index}-false">False</label><br>
            `;
        } else if (question.type === "1wordAnswer") {
            // For short answer, use a textarea
            optionsDiv.innerHTML += `
                 <input type="text" id="q${index}-fillin" name="question-${index}" placeholder="Enter your answer here...">
            `;
        } else if (question.type === "fillInTheBlanks") {
            // For fill in the blanks, use a single-line input
            optionsDiv.innerHTML += `
                <input type="text" id="q${index}-fillin" name="question-${index}" placeholder="Enter your answer here...">
            `;
        }
        questionDiv.appendChild(optionsDiv);
        quizForm.appendChild(questionDiv);
    });

    // Add event listener for quiz submission
    quizForm.onsubmit = submitStudentQuiz;
}

function submitStudentQuiz(e) {
    e.preventDefault();
    // In a real application, you would collect answers and send them to the server.
    // For now, let's just log the answers.
    const form = e.target;
    const studentAnswers = {};
    currentStudentQuizData.questions.forEach((question, index) => {
        const questionName = `question-${index}`;
        if (question.type === "multipleChoice" || question.type === "trueFalse") {
            const selectedOption = form.querySelector(`input[name="${questionName}"]:checked`);
            studentAnswers[questionName] = selectedOption ? selectedOption.value : "No answer";
        } else if (question.type === "shortAnswer") {
            const shortAnswer = form.querySelector(`textarea[name="${questionName}"]`);
            studentAnswers[questionName] = shortAnswer ? shortAnswer.value : "No answer";
        } else if (question.type === "fillInTheBlanks") {
            const fillInTheBlanks = form.querySelector(`input[name="${questionName}"]`);
            studentAnswers[questionName] = fillInTheBlanks ? fillInTheBlanks.value : "No answer";
        }
    });

    console.log("Student's Quiz Submission:", studentAnswers);
    // You can send `studentAnswers` to a backend for grading
    // For now, just close the modal and display a confirmation message.
    document.getElementsByClassName("startQuiz")[0].remove();
    closeQuizModal();
    displayMessage("Quiz submitted successfully!", "success");
}

// Custom Message Box (replacing alert)
function displayMessage(message, type = "info") {
    const messageBox = document.createElement('div');
    messageBox.className = `custom-message-box ${type}`;
    messageBox.textContent = message;
    document.body.appendChild(messageBox);

    // Trigger the animation
    requestAnimationFrame(() => {
        messageBox.classList.add('show-message');
    });

    setTimeout(() => {
        messageBox.classList.remove('show-message'); // Start fade-out
        messageBox.addEventListener('transitionend', () => messageBox.remove(), { once: true });
    }, 2700); // Remove after animation + slight delay
}

async function submitDoubt(event) {
    event.preventDefault();
    const doubtInput = event.target.querySelector('input[type="text"]');
    const doubtText = doubtInput.value.trim();

    if (!doubtText) {
        displayMessage("Please enter a doubt.", "warning");
        return;
    }

    // Simulate sending the doubt to the server
    try {
        const response = await fetch('/doubtClear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ doubt: doubtText })
        });

        if (!response.ok) throw new Error("Network response was not ok");

        const result = await response.json();
        displayMessage("Doubt submitted successfully!", "success");
        // Ensure 'doubts-chatoutput' exists in your HTML
        const doubtsChatOutput = document.getElementById("doubts-chatoutput");
        if (doubtsChatOutput) {
            doubtsChatOutput.innerHTML += `<div class="message">${doubtText}</div>`;
            doubtsChatOutput.innerHTML += `<div class="message">${result.answer}</div>`;
            doubtsChatOutput.scrollTop = doubtsChatOutput.scrollHeight; // Scroll to bottom
        } else {
            console.error("Element with id 'doubts-chatoutput' not found.");
        }
        doubtInput.value = ""; // Clear the input
    } catch (error) {
        console.error("Error submitting doubt:", error);
        displayMessage("Error submitting doubt. Please try again.", "error");
    }
}

function generateNotes() {
    const notesContent = document.getElementById("notes-content");
    const notesExtras = document.getElementById("notes-extras");
    notesContent.innerHTML = ""; // Clear previous notes
    notesExtras.innerHTML = ""; // Clear previous extras

    // Show loading animation for notes generation
    showLoading();

    // Get the content directly from the 'material-output' div
    const materialOutputDiv = document.getElementById("material-output");
    let materialContent = materialOutputDiv ? materialOutputDiv.textContent.trim() : "";

    // Fallback if no material content is found
    if (materialContent === "" || materialContent === "Material shared by teacher shown here...") {
        materialContent = "No material available. Please provide some content to generate notes from.";
    }

    console.log("Generating notes for:", materialContent); // Added for debugging

    fetch('/generateNotes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ courseContent: materialContent })
    })

    fetch('/generateNotes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ courseContent: materialContent })
    })
    .then(response => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.json();
    })
    .then(data => {
        // Hide loading animation when data is received
        hideLoading();
        // Generate title
        if (data.title) {
          notesContent.innerHTML += `<div class="message" style="font-weight: bold; font-size: 1.8rem; text-align: center"> ${data.title}</div>`;
        }

        // Paragraphs
        let paragraphs = [];
        if (data.paragraphs && Array.isArray(data.paragraphs)) {
            data.paragraphs.forEach(element => {
                paragraphs.push(`<p>${element}</p>`);
            });
            notesContent.innerHTML += '<div class="message">' + paragraphs.join("") + '</div>';
        }

        // Bullet points (renamed from 'key-points' in JSON to 'key-points' in code)
        let keyPoints = [];
        if (data["key-points"] && Array.isArray(data["key-points"])) {
            data["key-points"].forEach(element => {
                keyPoints.push(`<li>${element}</li>`);
            });
            notesContent.innerHTML += `<div class="message"><h4>Key Points</h4><ul>${keyPoints.join("")}</ul></div>`;
        }

        
        // Summary (if available)
        if (data.summary) {
            notesContent.innerHTML += `<div class="message"><h4>Summary</h4><p>${data.summary}</p></div>`;
        }

        // Useful links (renamed from 'useful-links' in JSON to 'useful-links' in code)
        let usefulLinks = [];
        if (data["useful-links"] && Array.isArray(data["useful-links"])) {
            data["useful-links"].forEach(link => {
                // Assuming link is a string URL as per your JSON example: ["..."]
                usefulLinks.push(`<li><a href="${link}" target="_blank">${link}</a></li>`);
            });
            notesExtras.innerHTML += `<div class="message"><h4>Useful Resources</h4><ul>${usefulLinks.join("")}</ul></div>`;
        }

        displayMessage("Notes generated successfully!", "success");
    })
    .catch(error => {
        console.error("Error generating notes:", error);
        displayMessage("Failed to generate notes. Please try again.", "error");
        if (notesOutput) {
            notesOutput.innerHTML = `<div class="message error-message">❌ Failed to generate notes.</div>`;
        }
    })
    .finally(() => {
        // Ensure loading animation is hidden even if there's an error
        hideLoading();
    });
};


function downloadNotes() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    const notesContent = document.getElementById("notes-content").innerText || "";
    const notesExtras  = document.getElementById("notes-extras").innerText || "";

    // Function to sanitize: remove non-ASCII symbols (emojis, weird chars)
    function cleanText(text) {
        return text.replace(/[^\x20-\x7E\n\r]/g, "");
    }

    let cursorY = 60;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Your Notes", 40, cursorY);
    cursorY += 30;

    // Main Notes
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const cleanNotes = doc.splitTextToSize(cleanText(notesContent), 500);
    doc.text(cleanNotes, 40, cursorY);
    cursorY += cleanNotes.length * 14 + 40;

    // New page for Additional Resources
    doc.addPage();
    cursorY = 60;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Additional Resources", 40, cursorY);
    cursorY += 30;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const cleanExtras = doc.splitTextToSize(cleanText(notesExtras), 500);
    doc.text(cleanExtras, 40, cursorY);

    // Save PDF
    doc.save("notes.pdf");
}
// Ensure custom message box styles are available and updated
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Keyframes for slide-in animation */
        @keyframes slideInFromRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        /* Keyframes for fade-out animation */
        @keyframes fadeOutMessage {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }

        .custom-message-box {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 1rem;
            color: white;
            z-index: 2000;
            opacity: 0; /* Start hidden */
            transform: translateX(100%); /* Start off-screen to the right */
            transition: none; /* No initial transition */
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .custom-message-box.show-message {
            animation: slideInFromRight 0.3s ease-out forwards;
        }

        /* Apply fade-out when 'show-message' is removed for removal */
        .custom-message-box:not(.show-message) {
            animation: fadeOutMessage 0.3s ease-in forwards;
        }


        .custom-message-box.info {
            background-color: #399079;
        }
        .custom-message-box.success {
            background-color: #28a745;
        }
        .custom-message-box.warning {
            background-color: #ffc107;
            color: #333;
        }
        .custom-message-box.error {
            background-color: #dc3545;
        }
    `;
    document.head.appendChild(style);
});

/* Add this at the very top of the file, before any other code */


function setupTeacherCaptioning(classId) {
  const startBtn = document.getElementById("start-captioning-btn");
  const stopBtn = document.getElementById("stop-captioning-btn");
  const display = document.getElementById("live-captions-display");

  if (!startBtn || !stopBtn) return;

  let recognition;
  let isRecognizing = false;

  startBtn.onclick = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("SpeechRecognition not supported in this browser.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      console.log("🎙 Transcript:", transcript);

      // Emit caption to students
      socket.emit("liveCaption", {
        classId: classId,
        caption: transcript
      });

      // Show it locally too
      display.innerText = transcript;
    };

    recognition.onerror = (e) => {
      console.error("❌ Recognition error:", e);
      isRecognizing = false;
    };

    recognition.onend = () => {
      if (isRecognizing) {
        console.warn("⚠️ Recognition stopped unexpectedly. Restarting...");
        recognition.start();
      } else {
        console.log("🛑 Recognition stopped");
      }
    };

    recognition.start();
    isRecognizing = true;

    console.log("✅ Recognition started");
    startBtn.classList.add("hidden");
    stopBtn.classList.remove("hidden");
  };

  stopBtn.onclick = () => {
    if (recognition && isRecognizing) {
      isRecognizing = false;
      recognition.stop();
    }
    startBtn.classList.remove("hidden");
    stopBtn.classList.add("hidden");
  };
}


// ---- Live Captioning (Student Side) ----
function setupStudentCaptioning(classId) {
  const captionsBox = document.getElementById("live-captions-output");
  const languageSelector = document.getElementById("language-selector");

  if (!captionsBox) return;

  socket.emit("joinClass", classId);

  socket.on("receiveCaption", async (caption) => {
    console.log("📝 Received caption:", caption);

    let translatedText = caption;

    // Translate if selected language isn’t English
    const targetLang = languageSelector?.value || "en";
    if (targetLang !== "en") {
      try {
        const res = await fetch(`/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: caption, targetLang })
        });
        const data = await res.json();
        translatedText = data.translated || caption;
      } catch (err) {
        console.error("⚠️ Translation failed:", err);
      }
    }

    // Append transcript
    const p = document.createElement("p");
    p.textContent = translatedText;
    captionsBox.appendChild(p);

    // Auto-scroll
    captionsBox.scrollTop = captionsBox.scrollHeight;
  });
}



// Init depending on dashboard type
document.addEventListener("DOMContentLoaded", () => {
  setupTeacherCaptioning();
  setupStudentCaptioning();
})

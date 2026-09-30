(() => {
  "use strict";

  const STORAGE_KEY = "focusflow-v1";

  const defaultState = {
    tasks: [],
    notes: "",
    sessions: 0,
    timerMinutes: 25
  };

  let state = loadState();
  let activeFilter = "all";
  let timerSeconds = state.timerMinutes * 60;
  let timerRunning = false;
  let timerInterval = null;
  let toastTimeout = null;

  const $ = (selector) => document.querySelector(selector);

  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const elements = {
    dateLabel: $("#dateLabel"),
    completedStat: $("#completedStat"),
    remainingStat: $("#remainingStat"),
    sessionsStat: $("#sessionsStat"),
    progressStat: $("#progressStat"),
    streakCount: $("#streakCount"),

    sidebarGoal: $("#sidebarGoal"),
    sidebarProgress: $("#sidebarProgress"),
    sidebarMessage: $("#sidebarMessage"),

    taskForm: $("#taskForm"),
    taskInput: $("#taskInput"),
    taskList: $("#taskList"),
    emptyState: $("#emptyState"),

    notesInput: $("#notesInput"),
    characterCount: $("#characterCount"),
    saveState: $("#saveState"),
    clearNotes: $("#clearNotes"),

    timerDisplay: $("#timerDisplay"),
    timerStatus: $("#timerStatus"),
    timerStart: $("#timerStart"),
    timerReset: $("#timerReset"),

    clearDataBtn: $("#clearDataBtn"),

    toast: $("#toast")
  };


  /* =========================
     STORAGE
  ========================= */

  function loadState() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );

      if (!saved || typeof saved !== "object") {
        return {
          tasks: [],
          notes: "",
          sessions: 0,
          timerMinutes: 25
        };
      }

      return {
        tasks: Array.isArray(saved.tasks)
          ? saved.tasks.filter(isValidTask)
          : [],

        notes:
          typeof saved.notes === "string"
            ? saved.notes
            : "",

        sessions:
          Number.isFinite(saved.sessions)
            ? Math.max(0, saved.sessions)
            : 0,

        timerMinutes:
          [5, 15, 25].includes(saved.timerMinutes)
            ? saved.timerMinutes
            : 25
      };

    } catch (error) {
      return {
        tasks: [],
        notes: "",
        sessions: 0,
        timerMinutes: 25
      };
    }
  }


  function isValidTask(task) {
    return (
      task &&
      typeof task.id === "string" &&
      typeof task.text === "string" &&
      typeof task.completed === "boolean"
    );
  }


  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      showToast("Browser storage is unavailable.");
    }
  }


  /* =========================
     SECURITY
  ========================= */

  function escapeHTML(value) {
    return value.replace(
      /[&<>"']/g,
      (character) => {
        const entities = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        };

        return entities[character];
      }
    );
  }


  /* =========================
     DATE
  ========================= */

  function renderDate() {
    const now = new Date();

    elements.dateLabel.textContent =
      now
        .toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric"
        })
        .toUpperCase();
  }


  /* =========================
     TASKS
  ========================= */

  function renderTasks() {

    const filteredTasks = state.tasks.filter(
      (task) => {

        if (activeFilter === "active") {
          return !task.completed;
        }

        if (activeFilter === "completed") {
          return task.completed;
        }

        return true;
      }
    );


    elements.taskList.innerHTML =
      filteredTasks
        .map(
          (task) => `
            <article
              class="task-item ${task.completed ? "done" : ""}"
              data-id="${task.id}"
            >

              <button
                class="check-btn"
                type="button"
                data-action="toggle"
                aria-label="${
                  task.completed
                    ? "Mark task active"
                    : "Mark task complete"
                }"
              >
                ${task.completed ? "✓" : ""}
              </button>

              <span class="task-text">
                ${escapeHTML(task.text)}
              </span>

              <button
                class="delete-btn"
                type="button"
                data-action="delete"
                aria-label="Delete task"
              >
                ✕
              </button>

            </article>
          `
        )
        .join("");


    elements.emptyState.hidden =
      filteredTasks.length !== 0;
  }


  function renderStats() {

    const completed =
      state.tasks.filter(
        (task) => task.completed
      ).length;

    const remaining =
      state.tasks.length - completed;

    const progress =
      state.tasks.length > 0
        ? Math.round(
            (completed / state.tasks.length) * 100
          )
        : 0;


    elements.completedStat.textContent =
      completed;

    elements.remainingStat.textContent =
      remaining;

    elements.sessionsStat.textContent =
      state.sessions;

    elements.progressStat.textContent =
      `${progress}%`;

    elements.streakCount.textContent =
      completed;


    const goalTotal =
      Math.max(state.tasks.length, 5);

    elements.sidebarGoal.textContent =
      `${completed} / ${goalTotal} tasks`;

    elements.sidebarProgress.style.width =
      `${progress}%`;


    if (state.tasks.length === 0) {

      elements.sidebarMessage.textContent =
        "Start with one small task.";

    } else if (progress === 100) {

      elements.sidebarMessage.textContent =
        "Everything is done. Nice work.";

    } else if (progress >= 50) {

      elements.sidebarMessage.textContent =
        "You're making solid progress.";

    } else {

      elements.sidebarMessage.textContent =
        "Keep going. One task at a time.";
    }
  }


  function addTask(text) {

    const cleanText =
      text.trim();

    if (!cleanText) {
      return;
    }


    state.tasks.unshift({
      id:
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,

      text: cleanText,

      completed: false
    });


    saveState();

    renderTasks();

    renderStats();

    elements.taskInput.value = "";

    elements.taskInput.focus();

    showToast("Task added.");
  }


  function toggleTask(id) {

    const task =
      state.tasks.find(
        (item) => item.id === id
      );

    if (!task) {
      return;
    }


    task.completed =
      !task.completed;

    saveState();

    renderTasks();

    renderStats();
  }


  function deleteTask(id) {

    const index =
      state.tasks.findIndex(
        (item) => item.id === id
      );

    if (index === -1) {
      return;
    }


    state.tasks.splice(index, 1);

    saveState();

    renderTasks();

    renderStats();

    showToast("Task removed.");
  }


  /* =========================
     NOTES
  ========================= */

  function renderNotes() {

    elements.notesInput.value =
      state.notes;

    updateCharacterCount();
  }


  function updateCharacterCount() {

    elements.characterCount.textContent =
      `${elements.notesInput.value.length} / 2000`;
  }


  /* =========================
     TIMER
  ========================= */

  function renderTimer() {

    const minutes =
      Math.floor(timerSeconds / 60);

    const seconds =
      timerSeconds % 60;


    elements.timerDisplay.textContent =
      `${String(minutes).padStart(2, "0")}:${String(
        seconds
      ).padStart(2, "0")}`;
  }


  function setTimer(minutes) {

    stopTimer();

    state.timerMinutes =
      minutes;

    timerSeconds =
      minutes * 60;

    saveState();

    renderTimer();

    elements.timerStatus.textContent =
      "Ready";

    $$(".preset").forEach(
      (button) => {

        button.classList.toggle(
          "active",
          Number(button.dataset.minutes) === minutes
        );

      }
    );

    elements.timerStart.textContent =
      "Start focus";
  }


  function startTimer() {

    if (timerRunning) {

      stopTimer();

      elements.timerStart.textContent =
        "Start focus";

      elements.timerStatus.textContent =
        "Paused";

      return;
    }


    if (timerSeconds <= 0) {

      timerSeconds =
        state.timerMinutes * 60;
    }


    timerRunning = true;

    elements.timerStart.textContent =
      "Pause";

    elements.timerStatus.textContent =
      "Focusing";


    timerInterval =
      window.setInterval(
        () => {

          timerSeconds -= 1;

          renderTimer();


          if (timerSeconds <= 0) {
            completeTimer();
          }

        },
        1000
      );
  }


  function stopTimer() {

    timerRunning = false;

    if (timerInterval !== null) {

      window.clearInterval(
        timerInterval
      );

      timerInterval = null;
    }
  }


  function completeTimer() {

    stopTimer();

    timerSeconds = 0;

    renderTimer();


    state.sessions += 1;

    saveState();

    renderStats();


    elements.timerStart.textContent =
      "Start focus";

    elements.timerStatus.textContent =
      "Complete";


    showToast(
      "Focus session complete. Great work."
    );
  }


  function resetTimer() {

    stopTimer();

    timerSeconds =
      state.timerMinutes * 60;

    renderTimer();

    elements.timerStart.textContent =
      "Start focus";

    elements.timerStatus.textContent =
      "Ready";
  }


  /* =========================
     TOAST
  ========================= */

  function showToast(message) {

    elements.toast.textContent =
      message;

    elements.toast.classList.add(
      "show"
    );


    window.clearTimeout(
      toastTimeout
    );


    toastTimeout =
      window.setTimeout(
        () => {

          elements.toast.classList.remove(
            "show"
          );

        },
        2200
      );
  }


  /* =========================
     EVENT LISTENERS
  ========================= */

  elements.taskForm.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();

      addTask(
        elements.taskInput.value
      );
    }
  );


  elements.taskList.addEventListener(
    "click",
    (event) => {

      const button =
        event.target.closest(
          "button[data-action]"
        );

      if (!button) {
        return;
      }


      const taskItem =
        button.closest(
          ".task-item"
        );

      if (!taskItem) {
        return;
      }


      const id =
        taskItem.dataset.id;


      if (
        button.dataset.action ===
        "toggle"
      ) {
        toggleTask(id);
      }


      if (
        button.dataset.action ===
        "delete"
      ) {
        deleteTask(id);
      }
    }
  );


  $$(".filter").forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          activeFilter =
            button.dataset.filter;


          $$(".filter").forEach(
            (item) => {

              item.classList.toggle(
                "active",
                item === button
              );

            }
          );


          renderTasks();
        }
      );
    }
  );


  elements.notesInput.addEventListener(
    "input",
    () => {

      state.notes =
        elements.notesInput.value;

      saveState();

      updateCharacterCount();

      elements.saveState.textContent =
        "Saved";
    }
  );


  elements.clearNotes.addEventListener(
    "click",
    () => {

      if (!elements.notesInput.value) {
        return;
      }


      elements.notesInput.value =
        "";

      state.notes =
        "";

      saveState();

      updateCharacterCount();

      elements.saveState.textContent =
        "Saved";

      showToast(
        "Notes cleared."
      );
    }
  );


  $$(".preset").forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          setTimer(
            Number(
              button.dataset.minutes
            )
          );

        }
      );
    }
  );


  elements.timerStart.addEventListener(
    "click",
    startTimer
  );


  elements.timerReset.addEventListener(
    "click",
    resetTimer
  );


  elements.clearDataBtn.addEventListener(
    "click",
    () => {

      const confirmed =
        window.confirm(
          "Reset all FocusFlow data? This will remove your tasks, notes and session count."
        );


      if (!confirmed) {
        return;
      }


      stopTimer();


      state = {
        tasks: [],
        notes: "",
        sessions: 0,
        timerMinutes: 25
      };


      timerSeconds =
        25 * 60;


      activeFilter =
        "all";


      saveState();


      $$(".filter").forEach(
        (button) => {

          button.classList.toggle(
            "active",
            button.dataset.filter === "all"
          );

        }
      );


      renderTasks();

      renderStats();

      renderNotes();

      setTimer(25);


      showToast(
        "FocusFlow has been reset."
      );
    }
  );


  /* =========================
     INITIALIZE
  ========================= */

  renderDate();

  renderTasks();

  renderStats();

  renderNotes();

  renderTimer();

})();
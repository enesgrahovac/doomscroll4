import { Goal } from "../shared/types";
import { UserProfile, DEFAULT_PROFILE } from "../shared/profile";
import { getProfile, saveProfile, getStats, getApiConfig, saveApiConfig } from "../shared/storage";
import { drawGremlin } from "../shared/gremlin";
import { TOKENS } from "../shared/tokens";

// State
let currentScreen = 0;
let interests: string[] = [];
let avoids: string[] = [];
let selectedGoal: Goal = "learn";

// DOM refs
const mainPanel = document.getElementById("main-panel")!;
const onboardingPanel = document.getElementById("onboarding-panel")!;
const settingsPanel = document.getElementById("settings-panel")!;

// ── Init ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const profile = await getProfile();

  if (!profile.onboardingComplete) {
    showOnboarding();
  } else {
    showMain(profile);
  }
});

// ── Main Panel ────────────────────────────────────────
async function showMain(profile?: UserProfile) {
  mainPanel.classList.remove("hidden");
  onboardingPanel.classList.add("hidden");
  settingsPanel.classList.add("hidden");

  const stats = await getStats();
  document.getElementById("stat-shown")!.textContent = String(stats.shown);
  document.getElementById("stat-blurred")!.textContent = String(stats.blurred);
  document.getElementById("stat-hidden")!.textContent = String(stats.hidden);

  // Draw gremlin
  const canvas = document.getElementById("gremlin-canvas") as HTMLCanvasElement;
  drawGremlin(canvas, "idle", TOKENS);

  // Settings button
  document.getElementById("btn-settings")!.onclick = () => showSettings();
  document.getElementById("btn-feedback")!.onclick = () => {
    chrome.tabs.create({ url: "https://x.com/enesgrahovac" });
  };
}

// ── Settings Panel ────────────────────────────────────
async function showSettings() {
  mainPanel.classList.add("hidden");
  settingsPanel.classList.remove("hidden");

  const config = await getApiConfig();
  (document.getElementById("setting-api-url") as HTMLInputElement).value = config.apiUrl;
  (document.getElementById("setting-api-key") as HTMLInputElement).value = config.apiKey;

  document.getElementById("btn-settings-close")!.onclick = async () => {
    const profile = await getProfile();
    showMain(profile);
  };

  document.getElementById("btn-save-settings")!.onclick = async () => {
    const apiUrl = (document.getElementById("setting-api-url") as HTMLInputElement).value.trim();
    const apiKey = (document.getElementById("setting-api-key") as HTMLInputElement).value.trim();
    await saveApiConfig({ apiUrl: apiUrl || "http://localhost:8000", apiKey });
    const profile = await getProfile();
    showMain(profile);
  };

  document.getElementById("btn-edit-profile")!.onclick = () => {
    showOnboarding();
  };
}

// ── Onboarding ────────────────────────────────────────
function showOnboarding() {
  mainPanel.classList.add("hidden");
  settingsPanel.classList.add("hidden");
  onboardingPanel.classList.remove("hidden");

  currentScreen = 0;
  interests = [];
  avoids = [];
  selectedGoal = "learn";

  updateScreen();
  setupChipInput("interest-input", "interest-chips", interests);
  setupChipInput("avoid-input", "avoid-chips", avoids);
  setupQuickChips("interest-quick", "interest-input", "interest-chips", interests);
  setupQuickChips("avoid-quick", "avoid-input", "avoid-chips", avoids);
  setupGoalButtons();
  setupObNav();
}

function updateScreen() {
  const screens = onboardingPanel.querySelectorAll<HTMLElement>(".ob-screen");
  screens.forEach((s, i) => {
    s.classList.toggle("hidden", i !== currentScreen);
  });

  const segs = onboardingPanel.querySelectorAll<HTMLElement>(".progress-seg");
  segs.forEach((s, i) => {
    s.classList.toggle("active", i <= currentScreen);
  });

  const backBtn = document.getElementById("ob-back") as HTMLButtonElement;
  const nextBtn = document.getElementById("ob-next") as HTMLButtonElement;
  backBtn.disabled = currentScreen === 0;
  nextBtn.textContent = currentScreen === 3 ? "DONE" : "NEXT";
}

function setupObNav() {
  document.getElementById("ob-back")!.onclick = () => {
    if (currentScreen > 0) {
      currentScreen--;
      updateScreen();
    }
  };

  document.getElementById("ob-next")!.onclick = async () => {
    if (currentScreen < 3) {
      currentScreen++;
      updateScreen();
    } else {
      // Save profile
      const profile: UserProfile = {
        interests: [...interests],
        goal: selectedGoal,
        avoids: [...avoids],
        platforms: {
          twitter: {
            intent: "",
            enabled: (document.getElementById("plat-twitter") as HTMLInputElement).checked,
          },
          linkedin: {
            intent: "",
            enabled: (document.getElementById("plat-linkedin") as HTMLInputElement).checked,
          },
          instagram: {
            intent: "",
            enabled: (document.getElementById("plat-instagram") as HTMLInputElement).checked,
          },
        },
        onboardingComplete: true,
        createdAt: Date.now(),
      };
      await saveProfile(profile);
      showMain(profile);
    }
  };
}

// ── Chip helpers ──────────────────────────────────────
function setupChipInput(inputId: string, listId: string, arr: string[]) {
  const input = document.getElementById(inputId) as HTMLInputElement;
  const list = document.getElementById(listId)!;

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = input.value.trim().toLowerCase();
      if (val && !arr.includes(val)) {
        arr.push(val);
        renderChips(list, arr);
      }
      input.value = "";
    }
  });
}

function renderChips(container: HTMLElement, arr: string[]) {
  container.innerHTML = "";
  arr.forEach((val, i) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = val;

    const rm = document.createElement("button");
    rm.className = "chip-remove";
    rm.textContent = "x";
    rm.addEventListener("click", () => {
      arr.splice(i, 1);
      renderChips(container, arr);
    });

    chip.appendChild(rm);
    container.appendChild(chip);
  });
}

function setupQuickChips(
  quickId: string,
  inputId: string,
  listId: string,
  arr: string[]
) {
  const container = document.getElementById(quickId)!;
  const list = document.getElementById(listId)!;

  container.querySelectorAll<HTMLButtonElement>(".quick-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.value!;
      if (!arr.includes(val)) {
        arr.push(val);
        renderChips(list, arr);
      }
    });
  });
}

function setupGoalButtons() {
  const buttons = onboardingPanel.querySelectorAll<HTMLButtonElement>(".goal-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedGoal = btn.dataset.goal as Goal;
    });
  });
}

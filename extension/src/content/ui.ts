import { FeedAction } from "../shared/types";

// Mark a post as pending classification (blur immediately)
export function applyPendingState(el: Element): void {
  if (el.classList.contains("ds4-pending") || el.hasAttribute("data-ds4-state")) return;
  el.classList.add("ds4-pending");
}

// Remove pending state
function removePending(el: Element): void {
  el.classList.remove("ds4-pending");
}

export function applyShowState(el: Element, reason?: string): void {
  removePending(el);
  el.setAttribute("data-ds4-state", "show");
  el.setAttribute("data-ds4-reason", reason || "");
  el.classList.add("ds4-show");

  // Add badge if not already present
  if (!el.querySelector(".ds4-show-badge")) {
    const badge = document.createElement("div");
    badge.classList.add("ds4-show-badge");
    badge.innerHTML = `<span class="ds4-badge-label">FEED</span>`;
    badge.title = reason || "Approved by Doomscroll4";
    (el as HTMLElement).style.position = (el as HTMLElement).style.position || "relative";
    el.appendChild(badge);
  }

  // Add reason footer as a sibling after the post (outside the article)
  if (!el.parentElement?.querySelector(".ds4-show-reason")) {
    const footer = document.createElement("div");
    footer.classList.add("ds4-show-reason");
    footer.textContent = reason || "Approved by Doomscroll4";
    el.insertAdjacentElement("afterend", footer);
  }
}

export function applyBlurState(el: Element, reason: string, onRetry?: () => void): void {
  removePending(el);
  el.setAttribute("data-ds4-state", "blur");
  el.setAttribute("data-ds4-reason", reason);

  // Don't re-apply if already blurred
  if (el.querySelector(".ds4-blur-wrapper")) return;

  const wrapper = document.createElement("div");
  wrapper.classList.add("ds4-blur-wrapper");

  // Prevent clicks from propagating to Twitter's article click handler
  wrapper.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  // Hide original content completely (collapsed)
  const contentWrap = document.createElement("div");
  contentWrap.classList.add("ds4-blur-content");
  while (el.firstChild) {
    contentWrap.appendChild(el.firstChild);
  }

  // Compact summary bar
  const bar = document.createElement("div");
  bar.classList.add("ds4-blur-bar");

  const label = document.createElement("span");
  label.classList.add("ds4-blur-label");
  label.textContent = "BLUR";

  const reasonEl = document.createElement("span");
  reasonEl.classList.add("ds4-blur-reason");
  reasonEl.textContent = reason;

  const btnGroup = document.createElement("div");
  btnGroup.classList.add("ds4-blur-actions");

  const revealBtn = document.createElement("button");
  revealBtn.classList.add("ds4-reveal-btn");
  revealBtn.textContent = "REVEAL";
  revealBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    contentWrap.classList.remove("ds4-blur-content");
    bar.remove();
    el.setAttribute("data-ds4-state", "revealed");
  });
  btnGroup.appendChild(revealBtn);

  if (onRetry) {
    const retryBtn = document.createElement("button");
    retryBtn.classList.add("ds4-retry-btn");
    retryBtn.textContent = "RETRY";
    retryBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      while (contentWrap.firstChild) {
        el.appendChild(contentWrap.firstChild);
      }
      wrapper.remove();
      el.removeAttribute("data-ds4-state");
      el.classList.add("ds4-pending");
      onRetry();
    });
    btnGroup.appendChild(retryBtn);
  }

  bar.appendChild(label);
  bar.appendChild(reasonEl);
  bar.appendChild(btnGroup);

  wrapper.appendChild(contentWrap);
  wrapper.appendChild(bar);
  el.appendChild(wrapper);
}

export function applyHideState(el: Element, reason: string): void {
  removePending(el);
  el.setAttribute("data-ds4-state", "hide");
  el.setAttribute("data-ds4-reason", reason);

  // Don't re-apply if already hidden
  if (el.querySelector(".ds4-hide-wrapper")) return;

  const originalHTML = el.innerHTML;
  const originalStyles = (el as HTMLElement).style.cssText;

  el.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.classList.add("ds4-hide-wrapper");

  // Prevent clicks from propagating to Twitter's article click handler
  wrapper.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  // Step 1: Compact bar with HIDDEN label + SEE WHY button
  const bar = document.createElement("div");
  bar.classList.add("ds4-hide-bar");

  const label = document.createElement("span");
  label.classList.add("ds4-hide-label");
  label.textContent = "HIDDEN";

  const seeWhyBtn = document.createElement("button");
  seeWhyBtn.classList.add("ds4-see-why-btn");
  seeWhyBtn.textContent = "SEE WHY";

  bar.appendChild(label);
  bar.appendChild(seeWhyBtn);

  // Step 2: Expanded reason panel (initially hidden)
  const reasonPanel = document.createElement("div");
  reasonPanel.classList.add("ds4-hide-reason-panel");

  const reasonEl = document.createElement("span");
  reasonEl.classList.add("ds4-hide-reason");
  reasonEl.textContent = reason;

  const revealBtn = document.createElement("button");
  revealBtn.classList.add("ds4-reveal-btn", "ds4-reveal-btn--danger");
  revealBtn.textContent = "REVEAL";

  reasonPanel.appendChild(reasonEl);
  reasonPanel.appendChild(revealBtn);

  // SEE WHY expands the reason panel
  seeWhyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    reasonPanel.classList.add("ds4-hide-reason-panel--visible");
    seeWhyBtn.remove();
  });

  // REVEAL restores the original post
  revealBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    el.innerHTML = originalHTML;
    (el as HTMLElement).style.cssText = originalStyles;
    el.setAttribute("data-ds4-state", "revealed");
  });

  wrapper.appendChild(bar);
  wrapper.appendChild(reasonPanel);
  el.appendChild(wrapper);
}

export function applyAction(el: Element, action: FeedAction, reason: string, onRetry?: () => void): void {
  switch (action) {
    case "show":
      applyShowState(el, reason);
      break;
    case "blur":
      applyBlurState(el, reason, onRetry);
      break;
    case "hide":
      applyHideState(el, reason);
      break;
  }
}

// Re-apply state to a post that was already classified (e.g. after scroll recycling)
export function reapplyState(el: Element): boolean {
  const state = el.getAttribute("data-ds4-state");
  if (!state || state === "revealed") return true; // already handled or user revealed

  const reason = el.getAttribute("data-ds4-reason") || "";

  // Check if the DOM was recycled (state attribute exists but visual state is gone)
  if (state === "show" && !el.classList.contains("ds4-show")) {
    el.classList.add("ds4-show");
    return true;
  }
  if (state === "blur" && !el.querySelector(".ds4-blur-wrapper")) {
    applyBlurState(el, reason);
    return true;
  }
  if (state === "hide" && !el.querySelector(".ds4-hide-wrapper")) {
    applyHideState(el, reason);
    return true;
  }

  return true; // state is still applied
}

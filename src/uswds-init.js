const loadingClass = "usa-js-loading";

function removeLoadingClass() {
  document.documentElement.classList.remove(loadingClass);
}

document.documentElement.classList.add(loadingClass);

const fallbackId = window.setTimeout(removeLoadingClass, 8000);

function completeWhenUswdsLoads() {
  if (!window.uswdsPresent) {
    return;
  }

  window.clearTimeout(fallbackId);
  removeLoadingClass();
  window.removeEventListener("load", completeWhenUswdsLoads, true);
}

window.addEventListener("load", completeWhenUswdsLoads, true);

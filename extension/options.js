const DEFAULT_URL = "http://localhost:8787/";
const input = document.getElementById("url");
const status = document.getElementById("status");

chrome.storage.sync.get({ url: DEFAULT_URL }).then(({ url }) => {
  input.value = url;
});

for (const b of document.querySelectorAll(".presets button")) {
  b.addEventListener("click", () => {
    input.value = b.dataset.url;
  });
}

document.getElementById("save").addEventListener("click", async () => {
  let url = input.value.trim() || DEFAULT_URL;
  try {
    url = new URL(url).toString();
  } catch {
    status.textContent = "Invalid URL";
    return;
  }
  await chrome.storage.sync.set({ url });
  status.textContent = "Saved ✓";
  setTimeout(() => (status.textContent = ""), 1500);
});

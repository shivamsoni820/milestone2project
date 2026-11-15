const apiUrl =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20";

const getId = (id) => document.getElementById(id);
const setText = (id, text) => { getId(id).textContent = text; };

const coinList = getId("coinList");
const loadingRows = getId("loadingRows");
const refreshBtn = getId("refreshBtn");
const retryBtn = getId("retryBtn");
const searchInput = getId("searchInput");
const sortSelect = getId("sortSelect");
const detailModal = getId("detailModal");

let coins = [];
let watchlist = [];
let showWatchlist = false;
let toastTimer;

try {
  const saved = JSON.parse(localStorage.getItem("marketWatchlist"));
  if (Array.isArray(saved)) watchlist = saved;
} catch {
  watchlist = [];
}

function dollars(value, compact = false) {
  if (value == null) return "—";
  return "$" + value.toLocaleString("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: value >= 1 ? 2 : 6
  });
}

function showChange(element, change) {
  element.textContent = change == null ? "—" : change.toFixed(2) + "%";
  element.classList.toggle("text-emerald-700", change != null && change >= 0);
  element.classList.toggle("text-red-700", change != null && change < 0);
}

function showStatus(message, retry = false) {
  setText("statusMessage", message);
  getId("statusRow").hidden = !message;
  retryBtn.hidden = !retry;
}

function updateSummary() {
  const top = coins[0];
  setText("totalCoins", coins.length);
  setText("topCoin", dollars(top?.current_price));
  setText("topCoinName", top?.name ?? "");
  setText("watchTotal", watchlist.length);
  setText("watchCount", watchlist.length);
}

async function loadCoins() {
  if (refreshBtn.disabled) return;

  refreshBtn.disabled = true;
  loadingRows.hidden = false;
  coinList.replaceChildren();
  showStatus("");

  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Request failed");

    const data = await response.json();
    coins = Array.isArray(data) ? data : [];
    setText("lastUpdated", coins.length ? "Updated " + new Date().toLocaleTimeString() : "");

    if (!coins.length) showStatus("No data found.", true);
  } catch {
    coins = [];
    setText("lastUpdated", "");
    showStatus("Could not load market data.", true);
  } finally {
    loadingRows.hidden = true;
    refreshBtn.disabled = false;
    updateSummary();
    renderCoins();
  }
}

function renderCoins() {
  if (refreshBtn.disabled || !coins.length) return;

  const search = searchInput.value.trim().toLowerCase();
  const shown = coins.filter((coin) => {
    const matches = coin.name.toLowerCase().includes(search) ||
      coin.symbol.toLowerCase().includes(search);
    return matches && (!showWatchlist || watchlist.includes(coin.id));
  });

  const sort = sortSelect.value;
  if (sort === "price_high") shown.sort((a, b) => b.current_price - a.current_price);
  if (sort === "price_low") shown.sort((a, b) => a.current_price - b.current_price);
  if (sort === "change_high") shown.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  if (sort === "change_low") shown.sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h);

coinList.replaceChildren();

if (showWatchlist && watchlist.length === 0) {
  showStatus("Your watchlist is empty. Save a coin from Markets.");
  return;
}

showStatus(shown.length ? "" : "No matching coins found.");

  for (const coin of shown) {
    const row = getId("coinTemplate").content.cloneNode(true);
    const cell = (name) => row.querySelector("[data-coin-" + name + "]");
    const saved = watchlist.includes(coin.id);

    row.querySelector("img").src = coin.image;
    cell("name").textContent = coin.name;
    cell("symbol").textContent = coin.symbol.toUpperCase();
    cell("price").textContent = dollars(coin.current_price);
    cell("cap").textContent = dollars(coin.market_cap, true);
    showChange(cell("change"), coin.price_change_percentage_24h);

    const saveBtn = cell("save");
    saveBtn.id = "save-" + coin.id;
    saveBtn.setAttribute("aria-label", "Save " + coin.name + " to watchlist");
    saveBtn.setAttribute("aria-pressed", saved);
    saveBtn.querySelector("i").classList.add(saved ? "fa-solid" : "fa-regular");
    saveBtn.onclick = () => saveCoin(coin.id);
    cell("details").onclick = () => showDetails(coin);

    coinList.append(row);
  }
}

function saveCoin(id) {
  const saved = watchlist.includes(id);
  watchlist = saved ? watchlist.filter((coinId) => coinId !== id) : [...watchlist, id];

  let message = saved ? "Removed from watchlist" : "Added to watchlist";
  try {
    localStorage.setItem("marketWatchlist", JSON.stringify(watchlist));
  } catch {
    message = "Watchlist updated for this session.";
  }

  setText("toast", message);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setText("toast", ""), 2500);

  updateSummary();
  renderCoins();
  (getId("save-" + id) || getId("watchlistNav")).focus();
}

function showDetails(coin) {
  getId("detailImage").src = coin.image;
  setText("detailName", coin.name);
  setText("detailSymbol", coin.symbol.toUpperCase());
  setText("detailPrice", dollars(coin.current_price));
  setText("detailCap", dollars(coin.market_cap, true));
  setText("detailHigh", dollars(coin.high_24h));
  setText("detailLow", dollars(coin.low_24h));
  setText("detailVolume", dollars(coin.total_volume, true));
  showChange(getId("detailChange"), coin.price_change_percentage_24h);
  getId("detailChange").textContent += " (24h)";
  detailModal.showModal();
}

function switchView(savedOnly) {
  showWatchlist = savedOnly;
  setText("sectionTitle", savedOnly ? "My watchlist" : "Top cryptocurrencies");
  getId("marketNav").setAttribute("aria-pressed", !savedOnly);
  getId("watchlistNav").setAttribute("aria-pressed", savedOnly);
  renderCoins();
}

searchInput.oninput = renderCoins;
sortSelect.onchange = renderCoins;
refreshBtn.onclick = function () {
  searchInput.value = "";
  loadCoins();
};
retryBtn.onclick = loadCoins;
getId("marketNav").onclick = () => switchView(false);
getId("watchlistNav").onclick = () => switchView(true);

for (let i = 0; i < 6; i++) {
  loadingRows.append(getId("skeletonTemplate").content.cloneNode(true));
}

updateSummary();
loadCoins();
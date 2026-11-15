const apiUrl =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20";

const getId = (id) => document.getElementById(id);

const coinList = getId("coinList");
const loadingRows = getId("loadingRows");
const refreshBtn = getId("refreshBtn");
const retryBtn = getId("retryBtn");
const searchInput = getId("searchInput");
const sortOptions = getId("sortOptions");
const sortSelect = getId("sortSelect");
const marketNav = getId("marketNav");
const watchlistNav = getId("watchlistNav");
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

function setText(id, text) {
  getId(id).textContent = text;
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

// Show the skeleton while market data is loading
async function loadCoins() {
  if (refreshBtn.disabled) return;

  refreshBtn.disabled = true;
  loadingRows.hidden = false;
  coinList.replaceChildren();
  showStatus("");

  try {
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error("API request failed");

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid market data");

    coins = data;

    if (coins.length) {
      setText("lastUpdated", "Updated " + new Date().toLocaleTimeString());
    } else {
      setText("lastUpdated", "");
      showStatus("No data found.", true);
    }
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

// Filter, sort, and display the coin rows
function renderCoins() {
  if (refreshBtn.disabled || coins.length === 0) return;

  coinList.replaceChildren();

  if (showWatchlist && watchlist.length === 0) {
    showStatus("Your watchlist is empty. Save a coin from Markets.");
    return;
  }

  const search = searchInput.value.trim().toLowerCase();
  const sort = sortOptions?.querySelector("input:checked")?.value
    ?? sortSelect?.value
    ?? "market_cap";

  const shown = coins.filter((coin) => {
    const matches = coin.name.toLowerCase().includes(search) ||
      coin.symbol.toLowerCase().includes(search);

    return matches && (!showWatchlist || watchlist.includes(coin.id));
  });

  if (sort === "price_high") {
    shown.sort((a, b) => b.current_price - a.current_price);
  } else if (sort === "price_low") {
    shown.sort((a, b) => a.current_price - b.current_price);
  } else if (sort === "change_high") {
    shown.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  } else if (sort === "change_low") {
    shown.sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h);
  }

  showStatus(shown.length ? "" : "No matching coins found.");

  for (const coin of shown) {
    const row = getId("coinTemplate").content.cloneNode(true);
    const field = (name) => row.querySelector("[data-coin-" + name + "]");
    const saved = watchlist.includes(coin.id);

    row.querySelector("img").src = coin.image;
    field("name").textContent = coin.name;
    field("symbol").textContent = coin.symbol.toUpperCase();
    field("price").textContent = dollars(coin.current_price);
    field("cap").textContent = dollars(coin.market_cap, true);
    showChange(field("change"), coin.price_change_percentage_24h);

    const saveBtn = field("save");
    saveBtn.id = "save-" + coin.id;
    saveBtn.setAttribute("aria-label", "Save " + coin.name + " to watchlist");
    saveBtn.setAttribute("aria-pressed", saved);
    saveBtn.querySelector("i").classList.add(saved ? "fa-solid" : "fa-regular");

    saveBtn.onclick = () => saveCoin(coin.id);
    field("details").onclick = () => showDetails(coin);

    coinList.append(row);
  }
}

function saveCoin(id) {
  const index = watchlist.indexOf(id);
  let message;

  if (index === -1) {
    watchlist.push(id);
    message = "Added to watchlist";
  } else {
    watchlist.splice(index, 1);
    message = "Removed from watchlist";
  }

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

  const saveBtn = getId("save-" + id) || watchlistNav;
  saveBtn.focus();
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

  const change = getId("detailChange");
  showChange(change, coin.price_change_percentage_24h);
  change.textContent += " (24h)";

  detailModal.showModal();
}

function switchView(savedOnly) {
  showWatchlist = savedOnly;
  marketNav.setAttribute("aria-pressed", !savedOnly);
  watchlistNav.setAttribute("aria-pressed", savedOnly);
  setText("sectionTitle", savedOnly ? "My watchlist" : "Top 20 Cryptocurrencies");
  renderCoins();
}

// Connect the controls
searchInput.oninput = renderCoins;
if (sortOptions) sortOptions.onchange = renderCoins;
if (sortSelect) sortSelect.onchange = renderCoins;

refreshBtn.onclick = loadCoins;
retryBtn.onclick = loadCoins;
marketNav.onclick = () => switchView(false);
watchlistNav.onclick = () => switchView(true);

// Prepare six skeleton rows and load the first results
for (let i = 0; i < 6; i++) {
  loadingRows.append(getId("skeletonTemplate").content.cloneNode(true));
}

updateSummary();
loadCoins();
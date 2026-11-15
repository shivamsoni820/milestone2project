const apiUrl =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20";

const getId = (id) => document.getElementById(id);

const coinList = getId("coinList");
const loadingRows = getId("loadingRows");
const refreshBtn = getId("refreshBtn");
const retryBtn = getId("retryBtn");
const searchInput = getId("searchInput");
const sortOptions = getId("sortOptions");
const marketNav = getId("marketNav");
const watchlistNav = getId("watchlistNav");

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

function showStatus(message, showRetry = false) {
  setText("statusMessage", message);
  getId("statusRow").hidden = !message;
  retryBtn.hidden = !showRetry;
}

function updateSummary() {
  const top = coins[0];

  setText("totalCoins", coins.length);
  setText("topCoin", dollars(top?.current_price));
  setText("topCoinName", top?.name ?? "");
  setText("watchTotal", watchlist.length);
  setText("watchCount", watchlist.length);
}

// Load market data and hide the skeleton when the request finishes
async function loadCoins() {
  if (refreshBtn.disabled) return;

  refreshBtn.disabled = true;
  coinList.replaceChildren();
  showStatus("");
  loadingRows.hidden = false;

  try {
    const response = await fetch(apiUrl, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) throw new Error("Request failed");

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid market data");

    coins = data;

    if (coins.length === 0) {
      setText("lastUpdated", "");
      showStatus("No data found.", true);
    } else {
      setText("lastUpdated", "Updated " + new Date().toLocaleTimeString());
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

// Filter and sort the coins before adding them to the table
function renderCoins() {
  if (refreshBtn.disabled || coins.length === 0) return;

  coinList.replaceChildren();

  if (showWatchlist && watchlist.length === 0) {
    showStatus("Your watchlist is empty. Save a coin from Markets.");
    return;
  }

  const search = searchInput.value.trim().toLowerCase();
  const sort = sortOptions.querySelector("input:checked").value;

  const visibleCoins = coins.filter((coin) => {
    const name = coin.name.toLowerCase();
    const symbol = coin.symbol.toLowerCase();
    const matchesSearch = name.includes(search) || symbol.includes(search);

    return matchesSearch && (!showWatchlist || watchlist.includes(coin.id));
  });

  if (sort === "price_high") {
    visibleCoins.sort((a, b) => b.current_price - a.current_price);
  } else if (sort === "price_low") {
    visibleCoins.sort((a, b) => a.current_price - b.current_price);
  } else if (sort === "change_high") {
    visibleCoins.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
  } else if (sort === "change_low") {
    visibleCoins.sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h);
  }

  showStatus(visibleCoins.length ? "" : "No matching coins found.");

  for (const coin of visibleCoins) {
    const row = getId("coinTemplate").content.cloneNode(true);
    const field = (name) => row.querySelector("[data-coin-" + name + "]");
    const saved = watchlist.includes(coin.id);
    const change = coin.price_change_percentage_24h;

    row.querySelector("img").src = coin.image;
    field("name").textContent = coin.name;
    field("symbol").textContent = coin.symbol.toUpperCase();
    field("price").textContent = dollars(coin.current_price);
    field("cap").textContent = dollars(coin.market_cap, true);

    const changeCell = field("change");
    changeCell.textContent = change == null ? "—" : change.toFixed(2) + "%";
    if (change != null) {
      changeCell.classList.add(change < 0 ? "text-red-700" : "text-emerald-700");
    }

    const saveBtn = field("save");
    saveBtn.id = "save-" + coin.id;
    saveBtn.setAttribute("aria-label", coin.name + " watchlist");
    saveBtn.setAttribute("aria-pressed", saved);
    saveBtn.querySelector("i").classList.add(saved ? "fa-solid" : "fa-regular");
    saveBtn.onclick = () => saveCoin(coin.id);

    coinList.append(row);
  }
}

// Add or remove a coin and store the watchlist
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

  const button = getId("save-" + id) || watchlistNav;
  button.focus();
}

function switchView(savedOnly) {
  showWatchlist = savedOnly;

  marketNav.setAttribute("aria-pressed", !savedOnly);
  watchlistNav.setAttribute("aria-pressed", savedOnly);
  setText("sectionTitle", savedOnly ? "My Watchlist" : "Top 20 Cryptocurrencies");

  renderCoins();
}

// Connect buttons and inputs
searchInput.oninput = renderCoins;
sortOptions.onchange = renderCoins;
refreshBtn.onclick = loadCoins;
retryBtn.onclick = loadCoins;
marketNav.onclick = () => switchView(false);
watchlistNav.onclick = () => switchView(true);

for (let i = 0; i < 6; i++) {
  loadingRows.append(getId("skeletonTemplate").content.cloneNode(true));
}

updateSummary();
loadCoins();
const isProd = window.location.hostname === "escape-game.btsinfo.nc";

const API_BASE_URL = isProd
  ? "https://escape-game.btsinfo.nc" // même domaine
  : "http://localhost:3000"; 
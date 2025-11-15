const isProd = window.location.hostname === "escape-game12.btsinfo.nc";

const API_BASE_URL = isProd
  ? "https://escape-game12.btsinfo.nc" // même domaine
  : "http://localhost:3000"; 
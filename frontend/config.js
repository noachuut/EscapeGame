const API_BASE_URL = window.location.hostname === "escape-game.btsinfo.nc"
  ? "http://escape_backend:3000"   // accès interne Docker en prod
  : "http://localhost:3000";       // pour le dev

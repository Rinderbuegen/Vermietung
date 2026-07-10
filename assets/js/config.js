window.APP_CONFIG = {
  buildingId: "dgh_rb",
  appTitle: "Vermietung Dorfgemeinschaftshaus Rinderbügen",
  buildingName: "Dorfgemeinschaftshaus Rinderbügen",
  heroTitle: "Dorfgemeinschaftshaus",
  heroLocation: "Rinderbügen",
  operatorName: "Betreiber Dorfgemeinschaftshaus Rinderbügen",
  contactEmail: "kontakt@example.com",
  apiBaseUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
  showPendingRequestsInOccupancy: true,
  publicShowBookingTitles: false,
  buildings: {
    dgh_rb: {
      appTitle: "Vermietung Dorfgemeinschaftshaus Rinderbügen",
      buildingName: "Dorfgemeinschaftshaus Rinderbügen",
      heroTitle: "Dorfgemeinschaftshaus",
      heroLocation: "Rinderbügen",
      operatorName: "Betreiber Dorfgemeinschaftshaus Rinderbügen",
      contactEmail: "kontakt@example.com",
      theme: {
        primary: "#6c0e15",
        primaryDark: "#5a0b11",
        secondary: "#872323",
        link: "#6c0e15",
        bgPage: "#eaeaea",
        bgMuted: "#f0f0f0",
        border: "#d8d2c6",
        dark: "#525151"
      }
    },
    ev_gem_rb: {
      appTitle: "Vermietung Evangelisches Gemeindehaus Rinderbügen",
      buildingName: "Evangelisches Gemeindehaus Rinderbügen",
      heroTitle: "Evangelisches Gemeindehaus",
      heroLocation: "Rinderbügen",
      operatorName: "Betreiber Evangelisches Gemeindehaus Rinderbügen",
      contactEmail: "kontakt@example.com",
      theme: {
        primary: "#5c2583",
        primaryDark: "#4a1d69",
        secondary: "#741cc0",
        link: "#5c2583",
        bgPage: "#f2ecfa",
        bgMuted: "#f2ecfa",
        border: "#e4cefa",
        dark: "#3d3050"
      }
    }
  }
};

(function () {
  const buildingIdByPath = {
    DGH: "dgh_rb",
    Gemeindehaus: "ev_gem_rb"
  };
  const config = window.APP_CONFIG;
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const requestedBuildingId = pathParts.map((part) => buildingIdByPath[part]).find(Boolean);
  if (!requestedBuildingId || !config.buildings || !config.buildings[requestedBuildingId]) {
    return;
  }
  Object.assign(config, config.buildings[requestedBuildingId], { buildingId: requestedBuildingId });
})();

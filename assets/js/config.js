window.APP_CONFIG = {
  buildingId: "dgh_rb",
  appTitle: "Vermietung Dorfgemeinschaftshaus Rinderbügen",
  buildingName: "Dorfgemeinschaftshaus Rinderbügen",
  operatorName: "Betreiber Dorfgemeinschaftshaus Rinderbügen",
  contactEmail: "kontakt@example.com",
  apiBaseUrl: "https://script.google.com/macros/s/DEPLOYMENT_ID/exec",
  showPendingRequestsInOccupancy: true,
  publicShowBookingTitles: false,
  buildings: {
    dgh_rb: {
      appTitle: "Vermietung Dorfgemeinschaftshaus Rinderbügen",
      buildingName: "Dorfgemeinschaftshaus Rinderbügen",
      operatorName: "Betreiber Dorfgemeinschaftshaus Rinderbügen",
      contactEmail: "kontakt@example.com"
    },
    ev_gem_rb: {
      appTitle: "Vermietung Evangelisches Gemeindehaus Rinderbügen",
      buildingName: "Evangelisches Gemeindehaus Rinderbügen",
      operatorName: "Betreiber Evangelisches Gemeindehaus Rinderbügen",
      contactEmail: "kontakt@example.com"
    }
  }
};

(function () {
  const buildingIdByPath = {
    "dgh-rb": "dgh_rb",
    "ev-gem-rb": "ev_gem_rb"
  };
  const config = window.APP_CONFIG;
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const requestedBuildingId = pathParts.map((part) => buildingIdByPath[part]).find(Boolean);
  if (!requestedBuildingId || !config.buildings || !config.buildings[requestedBuildingId]) {
    return;
  }
  Object.assign(config, config.buildings[requestedBuildingId], { buildingId: requestedBuildingId });
})();

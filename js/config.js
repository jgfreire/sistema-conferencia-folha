// Configuração geral do sistema CONFERÊNCIA DE FOLHA.
window.CF = window.CF || {};

CF.config = {
  appName: "Conferência de Folha",
  // Abaixo desta média de caracteres extraídos por página, o PDF é tratado como digitalizado (sem texto selecionável).
  minTextCharsPerPageThreshold: 60,
  maxPdfPagesForImages: 20,
  acceptedExtensions: ["pdf", "xls", "xlsx", "csv", "txt", "jpg", "jpeg", "png"]
};

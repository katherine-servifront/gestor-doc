//ID de la Unidad Compartida
const SHARED_DRIVE_ID = '0AH3nGSZDr3iJUk9PVA';

/**
 * @description Sirve la página web principal de la aplicación.
 * @returns {HtmlOutput} El servicio HTML para renderizar la página.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Formulario de Gestión Documental')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * @description Incluye el contenido de otros archivos (CSS, JS) en el HTML principal.
 * @param {string} filename - El nombre del archivo a incluir.
 * @returns {string} El contenido del archivo.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * @description Procesa los datos del formulario, crea la estructura de carpetas y guarda los archivos.
 * @param {object} formObject - Objeto con todos los datos y archivos del formulario.
 * @returns {string} Un mensaje de éxito.
 */
function processForm(formObject) {
  try {
    // Esto imprimirá las "llaves" (nombres de los campos) del objeto que llega al servidor.
    Logger.log("Datos recibidos: " + JSON.stringify(Object.keys(formObject)));

    const driveRoot = DriveApp.getFolderById(SHARED_DRIVE_ID);

    // --- 1. Crear la estructura de carpetas principal ---
    const country = formObject.pais.toUpperCase();
    const migrationProcess = formObject.proceso.toUpperCase();
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = `${(now.getMonth() + 1).toString().padStart(2, '0')}. ${now.toLocaleString('es-ES', { month: 'long' })}`;

    const mainFolderName = `${formObject.tipoId}_${formObject.numeroId}_${formObject.nombreCompleto.toUpperCase()}`;

    const yearFolder = getOrCreateFolder(driveRoot, year);
    const monthFolder = getOrCreateFolder(yearFolder, month);
    const countryFolder = getOrCreateFolder(monthFolder, country);
    const processFolder = getOrCreateFolder(countryFolder, migrationProcess);
    const clientFolder = getOrCreateFolder(processFolder, mainFolderName);
    
    // --- 2. Crear subcarpetas fijas ---
    const personalDocsFolder = getOrCreateFolder(clientFolder, "DOCUMENTOS PERSONALES");
    const academicFolder = getOrCreateFolder(clientFolder, "DOCUMENTOS ACADÉMICOS/ESTRATÉGICOS");
    getOrCreateFolder(clientFolder, "PAGOS Y CONTRATO");
    
    const titularFolder = getOrCreateFolder(personalDocsFolder, "DOCUMENTOS DEL TITULAR");
    const beneficiariesFolder = getOrCreateFolder(personalDocsFolder, "DOCUMENTOS DE BENEFICIARIOS");

    // --- 3. Procesar y guardar archivos del Titular ---
    const titularName = formObject.nombreCompleto;
    saveFile(titularFolder, formObject.partidaNacimiento, `PARTIDA_DE_NACIMIENTO_${titularName.toUpperCase()}`);
    saveFile(titularFolder, formObject.pasaporte, `PASAPORTE_${titularName.toUpperCase()}`);
    if (formObject.visa) saveFile(titularFolder, formObject.visa, `VISA_${titularName.toUpperCase()}`);
    if (formObject.actaMatrimonio) saveFile(titularFolder, formObject.actaMatrimonio, `ACTA_DE_MATRIMONIO_${titularName.toUpperCase()}`);
    
    // --- NUEVO: Guardar documentos académicos por separado ---
    saveFile(academicFolder, formObject.diploma, `DIPLOMA_${titularName.toUpperCase()}`);
    if (formObject.actaGrado) saveFile(academicFolder, formObject.actaGrado, `ACTA_DE_GRADO_${titularName.toUpperCase()}`);
    if (formObject.notas) saveFile(academicFolder, formObject.notas, `NOTAS_${titularName.toUpperCase()}`);


    // --- 4. Procesar documentos del Cónyuge (si aplica) ---
    if (formObject.estadoCivil === "Casado") {
      const spouseFolder = getOrCreateFolder(beneficiariesFolder, "CONYUGE");
      saveFile(spouseFolder, formObject.conyugePartidaNacimiento, "PARTIDA_DE_NACIMIENTO_CONYUGE");
      saveFile(spouseFolder, formObject.conyugePasaporte, "PASAPORTE_CONYUGE");
      if (formObject.conyugeVisa) saveFile(spouseFolder, formObject.conyugeVisa, "VISA_CONYUGE");
    }

    // --- 5. Procesar documentos de Hijos (si aplica) ---
    if (formObject.hijos && formObject.hijos.length > 0) {
      const hijosMainFolder = getOrCreateFolder(beneficiariesFolder, "HIJOS");
      formObject.hijos.forEach(hijo => {
        const hijoFolder = getOrCreateFolder(hijosMainFolder, hijo.nombre.toUpperCase());
        const childNameSanitized = hijo.nombre.replace(/\s/g, '_');
        saveFile(hijoFolder, hijo.partidaNacimiento, `PARTIDA_DE_NACIMIENTO_${childNameSanitized.toUpperCase()}`);
        saveFile(hijoFolder, hijo.pasaporte, `PASAPORTE_${childNameSanitized.toUpperCase()}`);
        if (hijo.visa) saveFile(hijoFolder, hijo.visa, `VISA_${childNameSanitized.toUpperCase()}`);
      });
    }
    /*GET LINK OF CLIENT FOLDER IN DRIVE AND SAVE IT IN BITRIX*/
    return "Formulario enviado y documentos guardados con éxito.";

  } catch (e) {
    Logger.log(e);
    throw new Error(`Error en el servidor: ${e.message}`);
  }
}

/**
 * @description Obtiene una carpeta por nombre dentro de una carpeta padre, o la crea si no existe.
 * @param {Folder} parentFolder - La carpeta donde buscar o crear.
 * @param {string} folderName - El nombre de la carpeta a buscar/crear.
 * @returns {Folder} La carpeta encontrada o creada.
 */
function getOrCreateFolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : parentFolder.createFolder(folderName);
}

/**
 * @description Decodifica un archivo base64 y lo guarda en la carpeta especificada.
 * @param {Folder} folder - La carpeta destino.
 * @param {object} fileData - Objeto con `mimeType`, `fileName` y `data` (base64).
 * @param {string} newFileName - El nuevo nombre para el archivo.
 */
function saveFile(folder, fileData, newFileName) {
  if (!fileData || !fileData.data) return; // No procesar si no hay archivo

  const decodedData = Utilities.base64Decode(fileData.data);
  const blob = Utilities.newBlob(decodedData, fileData.mimeType, newFileName);
  folder.createFile(blob);
}
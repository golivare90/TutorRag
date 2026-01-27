// CLAVE DE API: ¡REEMPLAZAR CON TU CLAVE DE GOOGLE AI STUDIO!
const API_KEY = "AIzaSyCoyPNg5qbRa8C-lC094yRHt7LaTxcu4ak"; 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;


//Este bloque conecta la interfaz de usuario (el botón en el popup de la extensión) con la lógica.
//Busca el botón en el HTML del popup.   Espera a que el usuario haga clic para iniciar el proceso.
document.getElementById('analyzeButton').addEventListener('click', () => {
    // 1. Mostrar estado de carga y limpiar salida anterior
    document.getElementById('loading').style.display = 'block';
    document.getElementById('output').innerText = 'Preparando solicitud...';

    // 2. Obtener la pestaña activa y ejecutar un script para CAPTURAR el texto
    //Es una API específica de Chrome filtrando para asegurar que obtenemos solo la pestaña que el usuario está viendo en ese momento exacto
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        
        // Ejecuta la función 'capturePageContent' en el contexto de la pestaña activa, esto hace que inyectemos el codigo definido en la funcion mas abajo
        chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: capturePageContent // Referencia a la función a inyectar
        }, (injectionResults) => {
            if (chrome.runtime.lastError || !injectionResults || injectionResults[0].result === undefined) {
                // Manejo de error si la inyección falla (ej. página de Chrome Store o internas)
                handleError("No se pudo acceder al contenido de esta página.");
                return;
            }
            //Si el texto es muy corto (menos de 50 caracteres), no vale la pena gastar tokens de la API. Ahorramos costos y tiempo
            const pageText = injectionResults[0].result;
            if (pageText.length < 50) {
                handleError("El contenido de la página es demasiado corto para analizar.");
                return;
            }
            
            // 3. CONTINUAR: Construir el prompt RAG y llamar a Gemini
            callGeminiAPI(pageText);
        });
    });
});

/**
 * Función que se inyecta en la página web para extraer su contenido.
 * @returns {string} El texto visible del cuerpo de la página.
 */
function capturePageContent() {
    // Excluye elementos que no son contenido principal (scripts, estilos, etc.)
    return document.body.innerText;
}

/**
 * Construye el prompt RAG y realiza la llamada a la API de Gemini.
 * @param {string} pageText El contenido de la página web capturado.
 */
async function callGeminiAPI(pageText) {
    document.getElementById('output').innerText = 'Enviando contexto y esperando IA...';

    //Aquí construimos el "cerebro" de la aplicación.
    // 4. CONSTRUCCIÓN DEL PROMPT RAG (Instrucción + Contexto)
    //Tenemos un prompt con "Rol" + "Tarea" + "Restriccion" 
    const systemInstruction = "Eres un tutor experto y amigable. Analiza el contenido de la página. Primero, proporciona un resumen de 1 párrafos del texto analizado con 5 bulletpoints. Después, genera 10 preguntas de opción múltiple con la respuesta correcta indicada para evaluar la comprensión. La respuesta debe ser SIEMPRE EN ESPAÑOL (Spanish), incluso si el texto de origen no lo está.";
    
    // El Contexto capturado se añade al final de la instrucción.
    const fullPrompt = `${systemInstruction}\n\n--- Contenido a Analizar ---\n\n${pageText}`;

    // 5. CONSTRUCCIÓN DEL BODY (Carga Útil JSON)
    //La API es estricta. Requiere un objeto con contents, que es un array de "turnos" de conversación, que contienen parts.
    const payload = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        // Usar un modelo más rápido y eficiente para esta tarea
        model: "gemini-2.5-flash" 
    };

    try {
        // 6. LANZAMIENTO DEL POST (Fetch API)
        //await fetch = Operación asíncrona. El código se "pausa" aquí hasta que Google responda.
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            // Manejo de error HTTP (ej. 400, 500)
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        // 7. EXTRACCIÓN Y RENDERIZACIÓN DE LA RESPUESTA
        //Esto es vital. Si la API devuelve un error o una estructura inesperada, el código no "truena", simplemente devuelve undefined y cae en el texto por defecto
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Error: No se recibió texto generado.";
        
        document.getElementById('output').innerText = generatedText;
        //Aqui manejamos un error de conexion
    } catch (error) {
        handleError(`Error al conectar con Gemini: ${error.message}`);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

/**
 * Función genérica para manejar y mostrar errores.
 * @param {string} message Mensaje de error a mostrar.
 */
function handleError(message) {
    document.getElementById('output').innerText = `[ERROR] ${message}`;
    document.getElementById('loading').style.display = 'none';
    console.error(message);
}
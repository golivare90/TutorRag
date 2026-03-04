import google.generativeai as genai
import os

# Pega tu API Key aquí para la prueba
os.environ["GOOGLE_API_KEY"] = ""
genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

print("--- Verificando Modelos Disponibles ---")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"Modelo encontrado: {m.name}")
except Exception as e:
    print(f"Error al listar modelos: {e}")

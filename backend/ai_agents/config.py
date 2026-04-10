"""
TRACR AI Agents — Configuration
Reads environment variables from backend/.env
"""
import os
from dotenv import load_dotenv

# Load from the parent directory's .env
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

MONGO_URI: str = os.getenv(
    'MONGO_URI',
    'mongodb://localhost:27017/intelligent_aml'
)

# Ensure intelligent_aml DB is selected
if 'mongodb+srv' in MONGO_URI and '/intelligent_aml' not in MONGO_URI:
    MONGO_URI = MONGO_URI.replace('?', 'intelligent_aml?', 1) if '?' in MONGO_URI \
        else MONGO_URI.rstrip('/') + '/intelligent_aml'

GEMINI_API_KEY: str = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL: str = 'gemini-1.5-flash'

NODE_BACKEND_URL: str = os.getenv('NODE_BACKEND_URL', 'http://localhost:3000')

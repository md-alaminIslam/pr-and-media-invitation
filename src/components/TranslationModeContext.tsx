import {createContext} from 'react';
export const TranslationModeContext=createContext<'offline'|'gemini'>('offline');

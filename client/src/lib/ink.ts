import { createContext, useContext } from 'react';

/** Tintenklecks aktiv → alle Cover und Bilder werden verschmiert */
export const InkContext = createContext(false);
export const useInked = () => useContext(InkContext);

import { createContext, useContext } from 'react';

/** The saved default options by field id, so a field left empty can show what it will use. */
export const Inherited = createContext(/** @type {Record<string, any>} */ ({}));

export const useInherited = () => useContext(Inherited);

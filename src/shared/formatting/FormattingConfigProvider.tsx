import React, { createContext, useContext, useEffect, useState } from 'react';
import { getConfig } from '../api/appApi';
import {
  getFormattingMetadata,
  setFormattingMetadata,
  type FormattingMetadata,
} from './formattingConfig';

type FormattingConfigProviderProps = {
  children: React.ReactNode;
};

const FormattingConfigContext = createContext<FormattingMetadata>(
  getFormattingMetadata()
);

export function useFormattingMetadata(): FormattingMetadata {
  return useContext(FormattingConfigContext);
}

export default function FormattingConfigProvider({
  children,
}: FormattingConfigProviderProps) {
  const [metadata, setMetadata] = useState<FormattingMetadata>(() =>
    getFormattingMetadata()
  );

  useEffect(() => {
    let active = true;

    getConfig()
      .then((payload) => {
        if (!active) return;
        setMetadata(setFormattingMetadata(payload));
      })
      .catch(() => {
        if (!active) return;
        setMetadata(getFormattingMetadata());
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <FormattingConfigContext.Provider value={metadata}>
      {children}
    </FormattingConfigContext.Provider>
  );
}
